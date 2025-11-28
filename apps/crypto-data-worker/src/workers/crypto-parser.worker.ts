import { PuppeteerService } from "../puppeteer.service";
import type {
  ChartPayload,
  CryptoCharts,
  CryptoData,
  ExtractedCoinFields,
  RangeKey,
  SeriesPoint,
  Sparkline7D,
} from "./crypto-worker-types";

import { RangeToButton, RangeToDaysParam, RangeToPriceChartsFile } from "./crypto-worker-constants";
import { NAVIGATION_TIMEOUT, SELECTOR_TIMEOUT, CATEGORY_SELECTOR_TIMEOUT, CHART_SELECTOR_TIMEOUT, CHART_RESPONSE_TIMEOUT } from "./crypto-worker-constants";
import type { WorkerInput } from "./crypto-worker-types";

const { parentPort } = require("worker_threads");
import { HTTPResponse, Page } from "puppeteer";

const puppeteerService = new PuppeteerService();

parentPort.on("message", async (data: WorkerInput) => {
  const {proxy, links} = data;
  const cryptoData: CryptoData[] = [];

  const page = await puppeteerService.newPage(proxy);
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
  page.setDefaultTimeout(SELECTOR_TIMEOUT);

  try {
    for (const link of links) {
      try {
        const cryptoD = await parseCoinWithRetry(page, link);
        cryptoData.push(cryptoD);
        console.log(
          `[WORKER] Parsed ${cryptoData.length}/${links.length} assets for proxy ${proxy.host}:${proxy.port}`,
        );
      } catch (e) {
        console.error(
          `[WORKER] proxy: ${proxy.host}:${proxy.port} Failed to parse ${link}:`,
          e,
        );
      }
    }
  } finally {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch {}

    await puppeteerService.closeBrowser(proxy);
  }

  puppeteerService
  parentPort.postMessage(cryptoData)
});

async function parseCoinWithRetry(page: Page, link: string, attempts = 2): Promise<CryptoData> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await parseCoin(page, link);
    } catch (e) {
      lastError = e;
      console.error(`[WORKER] attempt ${i + 1}/${attempts} failed for ${link}`, e);
      await sleep(1000);
    }
  }

  throw lastError;
}


const parseCoin = async (page, link: string): Promise<CryptoData> => {
    await page.goto(link, {
      waitUntil: 'domcontentloaded',        // быстрее, чем full load
      timeout: NAVIGATION_TIMEOUT,          // 60 сек
    });
    await page.waitForSelector('a[href*="/en/categories/"]', {
      timeout: CATEGORY_SELECTOR_TIMEOUT,
    }).catch(() => {});

    const fields = await page.evaluate(extractCoinDataInPageContext);
    if (!fields) {
      throw new Error('Failed to extract coin fields from page');
    }

    const chartByRange: Partial<Record<RangeKey, ChartPayload>> = {};
    for (const range of ['h24', 'd7', 'd30', 'd90', 'd365', 'max'] as RangeKey[]) {
      const payload = await clickAndGrabChart(page, range);
      if (!payload) {
        console.log(`[chart:${range}] payload=null`);
        continue;
      }
      chartByRange[range] = payload;
      await sleep(200); // дать дорисовать график между кликами
    }

    const charts: CryptoCharts = {
      h24: chartByRange.h24,
      d7: chartByRange.d7,
      d30: chartByRange.d30,
      d90: chartByRange.d90,
      d365: chartByRange.d365,
      max: chartByRange.max,
    };

    return {
      ...fields,
      sparkline7D: extractSparklineFromCharts(charts.d7?.stats),
      charts,
      source: link,
    };
  }

  // cъём одного диапазона графика кликом + фолбэки
 const clickAndGrabChart = async (page: Page, range: RangeKey): Promise<ChartPayload | null> => {
  try {
    await page.waitForSelector(RangeToButton[range], {
      timeout: CHART_SELECTOR_TIMEOUT, // 20 сек
    });
  } catch (e) {
    console.log(`[chart:${range}] button not found, skipping`, e);
    return null; // нет кнопки → просто нет графика
  }

  await page
    .evaluate(() => {
      const el = document.querySelector('[data-coin-chart-target="rangeSelector"]');
      if (el) (el as HTMLElement).scrollIntoView({ block: 'center' });
      window.scrollBy(0, 200);
    })
    .catch(() => {});

  const slug = getCoinSlugFromUrl(page.url()) || '';
  const file = RangeToPriceChartsFile[range];
  const daysParam = RangeToDaysParam[range];

  const toggleMap: Record<RangeKey, RangeKey> = {
    h24: 'd7',
    d7: 'd30',
    d30: 'd90',
    d90: 'd365',
    d365: 'max',
    max: 'd30',
  };

  const alreadySelected = await page
    .$eval(
      RangeToButton[range],
      (btn: HTMLElement) =>
        btn.classList.contains('selected') || btn.getAttribute('aria-pressed') === 'true'
    )
    .catch(() => false);

  if (alreadySelected) {
    const alt = toggleMap[range];
    await page.click(RangeToButton[alt]).catch(() => {});
    await page
      .waitForResponse(
        (res) => {
          if (!isSuccessJson(res)) return false;
          const u = res.url();
          const altFile = RangeToPriceChartsFile[alt];
          const re = slug
            ? new RegExp(`/price_charts/${slug}/usd/${altFile}(\\?|$)`, 'i')
            : new RegExp(`/price_charts/[^/]+/usd/${altFile}(\\?|$)`, 'i');
          return re.test(u);
        },
        { timeout: 12_000 }
      )
      .catch(() => {});
  }

  const waitResp = page.waitForResponse(
    (res) => {
      if (!isChartResponse(res)) return false;
      const u = res.url();
      let ok = /\/price_charts\//i.test(u) && new RegExp(`/usd/${file}(\\?|$)`, 'i').test(u);
      if (ok && slug)
        ok = new RegExp(`/price_charts/${slug}/usd/${file}(\\?|$)`, 'i').test(u);
      return ok || /\/(market_chart|ohlc)\b/i.test(u);
    },
    { timeout: CHART_RESPONSE_TIMEOUT }
  );

  const directFetchPromise = directPriceChartsFetch(page, slug, file);

  await page.click(RangeToButton[range]).catch(() => {});

  const payload = await Promise.race([
    (async () => {
      try {
        const resp = await waitResp;
        // console.log(
        //   `[chart:${range}] ${resp.status()} ${resp.url()} ct=${resp.headers()['content-type']}`
        // );
        return await normalizeChartPayload(resp);
      } catch {
        return null;
      }
    })(),
    directFetchPromise,
  ]);

  if (payload?.stats?.length) return payload;

  console.log(`[chart:${range}] primary+direct failed, trying market_chart fallback`);
  const mc = await directMarketChartFetch(page, slug, daysParam);
  if (mc?.stats?.length) {
    console.log(`[chart:${range}] market_chart fallback ok for ${slug} days=${daysParam}`);
    return mc;
  }

  console.log(`[chart:${range}] no data after all fallbacks`);
  return null;
}

const extractSparklineFromCharts = (chartsD7Stats: SeriesPoint[] | undefined): Sparkline7D | undefined => {
  if (!chartsD7Stats || chartsD7Stats.length === 0) {
    return undefined;
  }
  const sorted = [...chartsD7Stats].sort((a, b) => a[0] - b[0]);
  const prices = sorted
    .map(([, price]) => price)
    .filter((value) => Number.isFinite(value));

  if (prices.length === 0) {
    return undefined;
  }

  return { prices };
}

// топ-левел функция для page.evaluate 
function extractCoinDataInPageContext(): ExtractedCoinFields | null {
  const toText = (el: Element | null): string => (el?.textContent || '').trim();
  const toNumber = (s: string): number => {
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    return cleaned ? parseFloat(cleaned) : 0;
  };

  const getLogoUrl = (): string | null => {
    // основной вариант – тот самый img из блока заголовка
    const imgFromHeader = document.querySelector<HTMLImageElement>(
      'div.tw-mb-2 img.tw-rounded-full.tw-h-6.tw-w-6',
    );

    const img =
      imgFromHeader ||
      // запасной вариант по alt (BTC logo, ETH logo и т.п.)
      document.querySelector<HTMLImageElement>('img[alt$=" logo"]');

    if (!img) return null;

    const src = img.getAttribute('src') || img.src;
    return src || null;
  };

  const getTdByLabel = (exact: string): HTMLElement | null => {
    const rows = Array.from(document.querySelectorAll('table.tw-w-full tbody tr'));
    for (const r of rows) {
      const th = r.querySelector('th');
      if (!th) continue;
      let label = '';
      for (const node of Array.from(th.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = (node.textContent || '').trim();
          if (t) { label = t; break; }
        }
      }
      if (label.toLowerCase() === exact.toLowerCase()) {
        return r.querySelector('td') as HTMLElement | null;
      }
    }
    return null;
  };

  const readMoney = (td: HTMLElement | null): number => {
    if (!td) return 0;
    const span = td.querySelector('span[data-price-target="price"]') as HTMLElement | null;
    const v = span?.getAttribute('data-price-usd');
    return v ? parseFloat(v) : toNumber((span ? span.textContent : td.textContent) || '');
  };

  const readAmount = (td: HTMLElement | null): number => toNumber((td?.textContent || '').trim());

  const getChange = (index: number): number => {
    const row = document.querySelector('table.tw-overflow-hidden tbody tr');
    if (!row) return 0;
    const tds = row.querySelectorAll('td');
    const td = tds[index] as HTMLTableCellElement | undefined;
    if (!td) return 0;
    const span = td.querySelector('span[data-percent-change-target="percent"]') as HTMLElement | null;
    if (!span) return 0;

    try {
      const raw = span.getAttribute('data-json') || '{}';
      const obj = JSON.parse(raw);
      const v = typeof obj.usd === 'number' ? obj.usd : NaN;
      if (Number.isFinite(v)) return v;
    } catch {}

    return toNumber(toText(span));
  };

  const chipText = (a: HTMLAnchorElement): string => {
    const inner = a.querySelector('.tw-overflow-ellipsis, .tw-text-xs, div');
    const raw = (inner?.textContent ?? a.textContent ?? '').trim();
    if (/^\d+\s+more$/i.test(raw)) return '';
    if (/^suggest a category$/i.test(raw)) return '';
    return raw.replace(/\s+/g, ' ').trim();
  };

  const stripHtmlExceptLinks = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body;

    root.querySelectorAll('script, style, noscript, template, iframe').forEach((n) => n.remove());
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => h.remove());

    const unwrapChildren = (el: Element) => {
      Array.from(el.children).forEach((child) => {
        if (child.tagName === 'A') {
          const keep = new Set(['href', 'target', 'rel']);
          Array.from(child.attributes).forEach((attr) => {
            if (!keep.has(attr.name)) child.removeAttribute(attr.name);
          });
          if (child.getAttribute('target') === '_blank' && !child.getAttribute('rel')) {
            child.setAttribute('rel', 'noopener noreferrer');
          }
          unwrapChildren(child);
        } else {
          while (child.firstChild) el.insertBefore(child.firstChild, child);
          child.remove();
        }
      });
    };

    unwrapChildren(root);

    const result = root.innerHTML
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return result;
  };
  const logoUrl = getLogoUrl();

  const assetName =
    toText(document.querySelector('h1 .tw-font-bold')) ||
    toText(document.querySelector('h1 [data-view-component="true"].tw-font-bold')) ||
    toText(document.querySelector('h1')) ||
    '';

  let priceSpanText = toText(document.querySelector('h1 span'));
  let assetTicker = '';
  if (/price/i.test(priceSpanText)) {
    assetTicker = priceSpanText.replace(/price/i, '').trim();
  } else {
    const m = assetName.match(/\(([A-Z0-9]{2,10})\)/);
    if (m) assetTicker = m[1];
  }

  let currentAssetRank = 0;
  const maybeRank = Array.from(document.querySelectorAll('div,span'))
    .map((e) => toText(e))
    .find((t) => /^#\s*\d+/.test(t));
  if (maybeRank) currentAssetRank = parseInt(maybeRank.replace(/[^\d]/g, ''), 10) || 0;

  const priceEl = document.querySelector(
    'span[data-price-target="price"][data-converter-target="price"]'
  ) as HTMLElement | null;
  const attrUsd = priceEl?.getAttribute('data-price-usd') || '';
  const currentPrice = attrUsd
    ? parseFloat(attrUsd)
    : parseFloat((priceEl?.textContent || '').replace(/[^\d.-]/g, ''));

  const marketCap = readMoney(getTdByLabel('Market Cap'));
  const fdv = readMoney(getTdByLabel('Fully Diluted Valuation'));
  const volume24H = readMoney(getTdByLabel('24 Hour Trading Vol'));

  const circulatingSupply = readAmount(getTdByLabel('Circulating Supply'));
  const totalSupply = readAmount(getTdByLabel('Total Supply'));

  const maxTd = getTdByLabel('Max Supply');
  const maxTxt = (maxTd?.textContent || '').trim();
  const maxNum = toNumber(maxTxt);
  const maxSupply: number | string = maxNum > 0 ? maxNum : (maxTxt || '');

  const change1HUsdPct = getChange(0);
  const change24HUsdPct = getChange(1);
  const change7DUsdPct = getChange(2);
  const change14DUsdPct = getChange(3);
  const change30DUsdPct = getChange(4);
  const change1YUsdPct = getChange(5);

  const catAnchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/en/categories/"]')
  );
  const categories = Array.from(new Set(catAnchors.map(chipText).filter(Boolean)));
  const assetCategories = categories.join(';');

  const container = document.querySelector('#about .coin-page-editorial-content');
  if (!container) return null;

  const clone = container.cloneNode(true) as HTMLElement;

  const faqsHeader = clone.querySelector('.headline4 h2');
  if (faqsHeader) {
    const headlineBlock = faqsHeader.closest('.headline4') as HTMLElement | null;
    headlineBlock?.remove();
  }

  const html = clone.innerHTML;
  const cutIndex = html.search(/<h2[^>]*>\s*Bitcoin\s+FAQs\s*<\/h2>/i);
  const assetDescription = stripHtmlExceptLinks(cutIndex > -1 ? html.slice(0, cutIndex) : html);

  return {
    assetName,
    assetTicker,
    currentAssetRank,
    currentPrice,
    marketCap,
    fdv,
    volume24H,
    circulatingSupply,
    totalSupply,
    maxSupply,
    change1HUsdPct,
    change24HUsdPct,
    change7DUsdPct,
    change14DUsdPct,
    change30DUsdPct,
    change1YUsdPct,
    assetDescription,
    assetCategories,
    logoUrl
  };
}

const sleep = (ms: number): Promise<void> => {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const getCoinSlugFromUrl = (u: string): string | null => {
  try {
    const url = new URL(u);
    const m1 = url.pathname.match(/\/en\/coins\/([^/]+)/i);
    if (m1) return m1[1];
    const m2 = url.pathname.match(/\/price_charts\/([^/]+)/i);
    if (m2) return m2[1];
    return null;
  } catch {
    return null;
  }
}

const isSuccessJson = (res: HTTPResponse): boolean => {
  const status = res.status();
  const ok = (status >= 200 && status < 300) || status === 304;
  if (!ok) return false;
  const ct = (res.headers()['content-type'] || '').toLowerCase();
  return /json|javascript/.test(ct);
}

const isChartResponse = (res: HTTPResponse): boolean => {
  if (!isSuccessJson(res)) return false;
  const url = res.url();
  return /\/(market_chart|ohlc|price_charts)\b/i.test(url);
}

const directMarketChartFetch = async (
  page: Page,
  slug: string,
  daysParam: string
): Promise<ChartPayload | null> => {
  if (!slug) return null;
  const url = `/api/v3/coins/${slug}/market_chart?vs_currency=usd&days=${encodeURIComponent(
    daysParam
  )}&_=${Date.now()}`;

  const data = await page
    .evaluate((u: string) => {
      return fetch(u, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch((): null => null);
    }, url)
    .catch((): null => null);

  return data ? normalizeChartData(data) : null;
}

  // нормализация графиков
const normalizeChartData = (data: any): ChartPayload | null => {
  if (Array.isArray(data?.stats) && Array.isArray(data?.total_volumes)) {
    return { stats: data.stats, total_volumes: data.total_volumes };
  }
  if (Array.isArray(data?.prices) && Array.isArray(data?.total_volumes)) {
    return { stats: data.prices, total_volumes: data.total_volumes };
  }
  if (Array.isArray(data?.data?.prices) && Array.isArray(data?.data?.total_volumes)) {
    return { stats: data.data.prices, total_volumes: data.data.total_volumes };
  }
  if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length >= 5) {
    const stats: [number, number][] = data.map((d: any[]) => [Number(d[0]), Number(d[4])]);
    return { stats, total_volumes: [] };
  }
  return null;
}

// прямые fetch-ы (в браузерном контексте)
const directPriceChartsFetch = async (
  page: Page,
  slug: string,
  file: string
): Promise<ChartPayload | null> => {
  if (!slug) return null;
  const url = `/price_charts/${slug}/usd/${file}?_=${Date.now()}`;
  const data = await page
    .evaluate((u: string) => {
      return fetch(u, {
        credentials: 'same-origin',
        headers: { accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch((): null => null);
    }, url)
    .catch((): null => null);

  return data ? normalizeChartData(data) : null;
}

const normalizeChartPayload = async (resp: HTTPResponse): Promise<ChartPayload | null> => {
  try {
    const data = await resp.json();
    return normalizeChartData(data);
  } catch {
    return null;
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerService } from './puppeteer.service';
import { Cron } from '@nestjs/schedule';

import {
  RangeToButton,
  RangeToPriceChartsFile,
  RangeToDaysParam,
} from '@libs/contracts/crypto-data-worker';

import type {
  RangeKey,
  ChartPayload,
  CryptoCharts,
  CryptoData,
  ExtractedCoinFields,
  Sparkline7D,
  SeriesPoint,
} from '@libs/contracts/crypto-data-worker';
import { HTTPResponse, Page } from 'puppeteer';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

@Injectable()
export class CryptoDataScrapperService {
  private readonly log = new Logger('CryptoDataWorker');
  private readonly baseUrl = 'https://www.coingecko.com/en/all-cryptocurrencies';
  
  private isRunning = false;

  constructor(
    private readonly pp: PuppeteerService,
    private readonly cryproDataWorkerService: CryptoDataWorkerService,
  ) {}

  @Cron('*/1 * * * *') // каждые 5 минут
  async collectAllAssetsDataCron() {
    if (this.isRunning) {
      this.log.warn('Previous collectAllAssets run is still in progress, skipping this tick');
      return;
    }

    this.isRunning = true;
    try {
      await this.collectAllAssets();
    } catch (e) {
      this.log.error(`Cron collect failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  private async collectAllAssets() {
    this.log.log('Collecting TOP-200 from CoinGecko...');
    const page = await this.pp.newPage();

    try {
      await this.openAllCryptosPage(page, this.baseUrl);
      this.log.log('Ждем всех ссылок');

      const { totalCount } = await this.readAllCoinsMeta(page);

      // собираем ссылки и догружаем до 200
      let links = await this.collectLinks(page);
      links = await this.loadMoreUntil(page, {
        startPage: 2,
        hardLimit: 2000,
        maxLinks: 200, 
        totalCount,
      });

      this.log.log(`Collected ${links.length} links (need first 200).`);

      const top = links.slice(0, 200);
      for (let i = 0; i < top.length; i++) {
        const href = top[i];
        this.log.debug(`[${i + 1}/${top.length}] Parsing: ${href}`);

        try {
          const data = await this.parseCoin(page, href);
          await this.cryproDataWorkerService.upsertFromCryptoData(data);

          this.log.debug(
            `PARSED DATA for ${data.assetTicker} (rank=${data.currentAssetRank}) - ${href}`,
          );
        } catch (err) {
          this.log.warn(
            `Failed to parse ${href}: ${err instanceof Error ? err.message : err}`,
          );
        }
        // чуть притормаживаем, чтобы не кидать запросы слишком часто
        await this.sleep(200);
      }
    } finally {
      await this.pp.onModuleDestroy();
    }
  }

  private async openAllCryptosPage(page: Page, baseUrl: string): Promise<void> {
    await page.goto(baseUrl);
    await page.waitForSelector('tbody tr a[href^="/en/coins/"]', { timeout: 20_000 });
  }

  private async readAllCoinsMeta(page: Page): Promise<{ totalCount: number; pageSize: number }> {
    return page.evaluate(() => {
      const el = document.querySelector(
        'div[data-controller~="all-coins-index"][data-page-size]'
      ) as HTMLDivElement | null;
      return {
        totalCount: Number(el?.getAttribute('data-content-count') || '0'),
        pageSize: Number(el?.getAttribute('data-page-size') || '50'),
      };
    });
  }

  private async collectLinks(page: Page): Promise<string[]> {
    return page.$$eval('tbody tr a[href^="/en/coins/"]', (anchors: HTMLAnchorElement[]) => {
      return anchors
        .map((a) => a.href.replace(/[#?].*$/, ''))
        .filter(Boolean)
        .filter((href, i, arr) => arr.indexOf(href) === i);
    });
  }

  private async loadMoreUntil(
    page: Page,
    {
      startPage = 2,
      hardLimit = 2000,
      maxLinks = 100,
      totalCount = 0,
    }: { startPage?: number; hardLimit?: number; maxLinks?: number; totalCount?: number }
  ): Promise<string[]> {
    let pageNum = startPage;
    let stagnant = 0;

    let links = await this.collectLinks(page);

    for (let i = 0; i < hardLimit; i++) {
      if (totalCount > 0 && links.length >= totalCount) break;

      const added = await page
        .evaluate((p: number) => {
          const url = `/en/all-cryptocurrencies/show_more_coins?page=${p}`;
          return fetch(url, {
            headers: { Accept: 'text/html, */*;q=0.1', 'X-Requested-With': 'XMLHttpRequest' },
            method: 'GET',
            credentials: 'same-origin',
          })
            .then((res) => (res.ok ? res.text() : ''))
            .then((html) => {
              if (!html || !html.trim()) return 0;
              const tbody = document.querySelector('tbody');
              if (!tbody) return 0;

              const tmp = document.createElement('tbody');
              tmp.innerHTML = html;

              const rows = Array.from(tmp.querySelectorAll('tr'));
              for (const r of rows) tbody.appendChild(r);
              return rows.length;
            })
            .catch((): number => 0);
        }, pageNum)
        .catch((): number => 0);

      if (!added || added === 0) {
        stagnant++;
        if (stagnant >= 2) break;
      } else {
        stagnant = 0;
        pageNum++;
      }

      await this.sleep(150);
      links = await this.collectLinks(page);
      if (links.length > maxLinks) break;
    }

    return links;
  }

  // парсинг конкретной монеты
  private async parseCoin(page: Page, link: string): Promise<CryptoData> {
    await page.goto(link);
    await page.waitForSelector('body', { timeout: 20_000 });
    await page.waitForSelector('a[href*="/en/categories/"]', { timeout: 15_000 }).catch(() => {});

    const fields = await page.evaluate(extractCoinDataInPageContext);
    if (!fields) {
      throw new Error('Failed to extract coin fields from page');
    }

    const chartByRange: Partial<Record<RangeKey, ChartPayload>> = {};
    for (const range of ['h24', 'd7', 'd30', 'd90', 'd365', 'max'] as RangeKey[]) {
      const payload = await this.clickAndGrabChart(page, range);
      if (!payload) {
        this.log.debug(`[chart:${range}] payload=null`);
        continue;
      }
      chartByRange[range] = payload;
      await this.sleep(200); // дать дорисовать график между кликами
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
      sparkline7D: this.extractSparklineFromCharts(charts.d7?.stats),
      charts,
      source: link,
    };
  }

  private extractSparklineFromCharts(chartsD7Stats: SeriesPoint[] | undefined): Sparkline7D | undefined {
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

  // cъём одного диапазона графика кликом + фолбэки
  private async clickAndGrabChart(page: Page, range: RangeKey): Promise<ChartPayload | null> {
    await page.waitForSelector(RangeToButton[range], { timeout: 10_000 });
    await page
      .evaluate(() => {
        const el = document.querySelector('[data-coin-chart-target="rangeSelector"]');
        if (el) (el as HTMLElement).scrollIntoView({ block: 'center' });
        window.scrollBy(0, 200);
      })
      .catch(() => {});

    const slug = this.getCoinSlugFromUrl(page.url()) || '';
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
            if (!this.isSuccessJson(res)) return false;
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
        if (!this.isChartResponse(res)) return false;
        const u = res.url();
        let ok = /\/price_charts\//i.test(u) && new RegExp(`/usd/${file}(\\?|$)`, 'i').test(u);
        if (ok && slug)
          ok = new RegExp(`/price_charts/${slug}/usd/${file}(\\?|$)`, 'i').test(u);
        return ok || /\/(market_chart|ohlc)\b/i.test(u);
      },
      { timeout: 30_000 }
    );

    const directFetchPromise = this.directPriceChartsFetch(page, slug, file);

    await page.click(RangeToButton[range]).catch(() => {});

    const payload = await Promise.race([
      (async () => {
        try {
          const resp = await waitResp;
          // console.log(
          //   `[chart:${range}] ${resp.status()} ${resp.url()} ct=${resp.headers()['content-type']}`
          // );
          return await this.normalizeChartPayload(resp);
        } catch {
          return null;
        }
      })(),
      directFetchPromise,
    ]);

    if (payload?.stats?.length) return payload;

    this.log.debug(`[chart:${range}] primary+direct failed, trying market_chart fallback`);
    const mc = await this.directMarketChartFetch(page, slug, daysParam);
    if (mc?.stats?.length) {
      this.log.debug(`[chart:${range}] market_chart fallback ok for ${slug} days=${daysParam}`);
      return mc;
    }

    this.log.debug(`[chart:${range}] no data after all fallbacks`);
    return null;
  }

  // утилиты
  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private isSuccessJson(res: HTTPResponse): boolean {
    const status = res.status();
    const ok = (status >= 200 && status < 300) || status === 304;
    if (!ok) return false;
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    return /json|javascript/.test(ct);
  }

  private isChartResponse(res: HTTPResponse): boolean {
    if (!this.isSuccessJson(res)) return false;
    const url = res.url();
    return /\/(market_chart|ohlc|price_charts)\b/i.test(url);
  }

  private getCoinSlugFromUrl(u: string): string | null {
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

  // нормализация графиков
  private normalizeChartData(data: any): ChartPayload | null {
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

  private async normalizeChartPayload(resp: HTTPResponse): Promise<ChartPayload | null> {
    try {
      const data = await resp.json();
      return this.normalizeChartData(data);
    } catch {
      return null;
    }
  }

  // прямые fetch-ы (в браузерном контексте)
  private async directPriceChartsFetch(
    page: Page,
    slug: string,
    file: string
  ): Promise<ChartPayload | null> {
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

    return data ? this.normalizeChartData(data) : null;
  }

  private async directMarketChartFetch(
    page: Page,
    slug: string,
    daysParam: string
  ): Promise<ChartPayload | null> {
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

    return data ? this.normalizeChartData(data) : null;
  }
}

// топ-левел функция для page.evaluate 
function extractCoinDataInPageContext(): ExtractedCoinFields | null {
  const toText = (el: Element | null): string => (el?.textContent || '').trim();
  const toNumber = (s: string): number => {
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    return cleaned ? parseFloat(cleaned) : 0;
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
    assetCategories
  };
}

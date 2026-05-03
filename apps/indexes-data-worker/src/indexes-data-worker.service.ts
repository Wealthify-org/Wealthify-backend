import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IndexSnapshot } from './index-snapshot.model';

const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1';
const COINGECKO_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global';
const COINGECKO_TOP50_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=30d';
const YAHOO_SP500_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=2d&interval=1d';
const YAHOO_GOLD_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=2d&interval=1d';

const STABLES = new Set([
  'usdt', 'usdc', 'dai', 'tusd', 'busd', 'usde', 'fdusd',
  'pyusd', 'usdd', 'frax', 'usds', 'usd1', 'usdy',
]);

const FETCH_TIMEOUT_MS = 15_000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Yahoo иногда блокирует запросы без UA
        'User-Agent': 'Mozilla/5.0 (compatible; WealthifyBot/1.0)',
      },
    });
    if (!res.ok) {
      throw new Error(`${url} → HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface FearGreedResp {
  data: Array<{ value: string; value_classification: string }>;
}

interface CoinGeckoGlobalResp {
  data: {
    total_market_cap: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  price_change_percentage_30d_in_currency: number | null;
}

interface YahooChartResp {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        chartPreviousClose: number;
      };
    }>;
  };
}

@Injectable()
export class IndexesDataWorkerService implements OnModuleInit {
  private readonly logger = new Logger(IndexesDataWorkerService.name);

  constructor(
    @InjectModel(IndexSnapshot)
    private readonly snapshotRepo: typeof IndexSnapshot,
  ) {}

  async onModuleInit() {
    // если последний снэпшот старше 1 часа — снимем сразу при старте
    const latest = await this.snapshotRepo.findOne({
      order: [['capturedAt', 'DESC']],
    });
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (!latest || latest.capturedAt.getTime() < oneHourAgo) {
      this.logger.log('Initial snapshot missing or stale, fetching now…');
      void this.captureSnapshot().catch((e) =>
        this.logger.error('Initial snapshot failed', (e as Error)?.stack ?? e),
      );
    } else {
      this.logger.log(
        `Latest snapshot found at ${latest.capturedAt.toISOString()}, skipping initial fetch`,
      );
    }
  }

  // каждый час в начале часа
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyTick() {
    this.logger.log('Hourly indexes snapshot tick');
    try {
      await this.captureSnapshot();
    } catch (e) {
      this.logger.error('Hourly snapshot failed', (e as Error)?.stack ?? e);
    }
  }

  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  async getLatestSnapshot(): Promise<IndexSnapshot | null> {
    return this.snapshotRepo.findOne({
      order: [['capturedAt', 'DESC']],
    });
  }

  private async fetchFearGreed(): Promise<{ value: number; classification: string }> {
    const json = await fetchJson<FearGreedResp>(FEAR_GREED_URL);
    const item = json.data?.[0];
    if (!item) throw new Error('Fear & Greed: empty response');
    return {
      value: Number(item.value),
      classification: item.value_classification,
    };
  }

  private async fetchCoinGeckoGlobal(): Promise<{
    totalMcap: number;
    btcDom: number;
    ethDom: number;
    change24h: number;
  }> {
    const { data } = await fetchJson<CoinGeckoGlobalResp>(COINGECKO_GLOBAL_URL);
    return {
      totalMcap: data.total_market_cap.usd,
      btcDom: data.market_cap_percentage.btc,
      ethDom: data.market_cap_percentage.eth,
      change24h: data.market_cap_change_percentage_24h_usd ?? 0,
    };
  }

  private async fetchAltseason(): Promise<{ score: number; label: string }> {
    const coins = await fetchJson<CoinGeckoMarketCoin[]>(COINGECKO_TOP50_URL);
    const btc = coins.find((c) => c.symbol === 'btc');
    const btcPct = btc?.price_change_percentage_30d_in_currency ?? 0;

    const alts = coins.filter(
      (c) => c.symbol !== 'btc' && !STABLES.has(c.symbol.toLowerCase()),
    );
    if (alts.length === 0) {
      return { score: 0, label: 'Not Altseason' };
    }

    const beating = alts.filter(
      (c) => (c.price_change_percentage_30d_in_currency ?? -Infinity) > btcPct,
    ).length;

    const score = Math.round((beating / alts.length) * 100);
    let label: string;
    if (score >= 75) label = 'Altseason';
    else if (score <= 25) label = 'Bitcoin Season';
    else label = 'Not Altseason';

    return { score, label };
  }

  private async fetchYahooQuote(url: string): Promise<{ value: number; change24h: number }> {
    const json = await fetchJson<YahooChartResp>(url);
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) throw new Error(`Yahoo: empty meta for ${url}`);
    const value = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    const change = prev ? ((value - prev) / prev) * 100 : 0;
    return { value, change24h: change };
  }

  // собираем все источники параллельно. если какой-то упадёт — он не валит всё.
  async captureSnapshot(): Promise<IndexSnapshot> {
    const [fgRes, cgGlobalRes, altRes, sp500Res, goldRes] = await Promise.allSettled([
      this.fetchFearGreed(),
      this.fetchCoinGeckoGlobal(),
      this.fetchAltseason(),
      this.fetchYahooQuote(YAHOO_SP500_URL),
      this.fetchYahooQuote(YAHOO_GOLD_URL),
    ]);

    const last = await this.snapshotRepo.findOne({ order: [['capturedAt', 'DESC']] });

    const fg = fgRes.status === 'fulfilled' ? fgRes.value : null;
    const cg = cgGlobalRes.status === 'fulfilled' ? cgGlobalRes.value : null;
    const alt = altRes.status === 'fulfilled' ? altRes.value : null;
    const sp = sp500Res.status === 'fulfilled' ? sp500Res.value : null;
    const gold = goldRes.status === 'fulfilled' ? goldRes.value : null;

    const sources: Array<[string, PromiseSettledResult<unknown>]> = [
      ['fearGreed', fgRes],
      ['coingeckoGlobal', cgGlobalRes],
      ['altseason', altRes],
      ['sp500', sp500Res],
      ['gold', goldRes],
    ];
    for (const [name, res] of sources) {
      if (res.status === 'rejected') {
        this.logger.warn(`Source "${name}" failed: ${res.reason}`);
      }
    }

    // fall-back на последние известные значения если источник упал
    const totalMcap = cg?.totalMcap ?? last?.totalMarketCapUsd ?? 0;
    const btcDom = cg?.btcDom ?? last?.btcDominancePct ?? 0;
    const ethDom = cg?.ethDom ?? last?.ethDominancePct ?? 0;
    const total2 = totalMcap * (1 - btcDom / 100);
    const total3 = totalMcap * (1 - btcDom / 100 - ethDom / 100);

    const snapshot = await this.snapshotRepo.create({
      capturedAt: new Date(),

      fearGreedValue: fg?.value ?? last?.fearGreedValue ?? 0,
      fearGreedClassification: fg?.classification ?? last?.fearGreedClassification ?? 'Unknown',

      btcDominancePct: btcDom,
      ethDominancePct: ethDom,

      totalMarketCapUsd: totalMcap,
      total2MarketCapUsd: total2,
      total3MarketCapUsd: total3,
      totalMcapChange24hPct: cg?.change24h ?? last?.totalMcapChange24hPct ?? 0,

      altseasonScore: alt?.score ?? last?.altseasonScore ?? 0,
      altseasonLabel: alt?.label ?? last?.altseasonLabel ?? 'Not Altseason',

      sp500Value: sp?.value ?? last?.sp500Value ?? 0,
      sp500Change24hPct: sp?.change24h ?? last?.sp500Change24hPct ?? 0,
      goldValue: gold?.value ?? last?.goldValue ?? 0,
      goldChange24hPct: gold?.change24h ?? last?.goldChange24hPct ?? 0,
    });

    this.logger.log(
      `Snapshot saved id=${snapshot.id}: F&G=${snapshot.fearGreedValue} | BTC dom=${btcDom.toFixed(2)}% | Altseason=${snapshot.altseasonScore} | S&P=${snapshot.sp500Value.toFixed(2)} | Gold=${snapshot.goldValue.toFixed(2)}`,
    );
    return snapshot;
  }
}

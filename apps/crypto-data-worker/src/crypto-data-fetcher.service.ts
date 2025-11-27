import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch'; // если у тебя Node 18+ с глобальным fetch — можешь убрать этот импорт

import {
  ChartPayload,
  CryptoCharts,
  CryptoData,
  RangeKey,
  SeriesPoint,
  Sparkline7D,
} from '@libs/contracts/crypto-data-worker';
import { CryptoDataWorkerService } from './crypto-data-worker.service';
import { Cron } from '@nestjs/schedule';

type VsCurrency = 'usd' | 'eur' | 'btc' | string;

// ====== ТИПЫ ОТ COINGECKO API ======

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number | null;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number | null;
  low_24h: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
  market_cap_change_24h: number | null;
  market_cap_change_percentage_24h: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  max_supply: number | null;
  ath: number | null;
  ath_change_percentage: number | null;
  ath_date: string | null;
  atl: number | null;
  atl_change_percentage: number | null;
  atl_date: string | null;
  roi: {
    times: number;
    currency: string;
    percentage: number;
  } | null;
  last_updated: string;

  // Эти поля появляются, если указать price_change_percentage=...
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_14d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  price_change_percentage_1y_in_currency?: number | null;
}

interface CoinGeckoCoinDetails {
  id: string;
  symbol: string;
  name: string;
  asset_platform_id: string | null;
  hashing_algorithm: string | null;
  categories: string[];
  description: { [lang: string]: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    twitter_screen_name: string | null;
    subreddit_url: string | null;
    repos_url?: {
      github?: string[];
      bitbucket?: string[];
      [key: string]: string[] | undefined;
    };
    [key: string]: unknown;
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  genesis_date: string | null;
  sentiment_votes_up_percentage: number | null;
  sentiment_votes_down_percentage: number | null;
  market_cap_rank: number | null;
  coingecko_rank: number | null;
  coingecko_score: number | null;
  developer_score: number | null;
  community_score: number | null;
  liquidity_score: number | null;
  public_interest_score: number | null;
  market_data?: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    sparkline_7d?: {
      price: number[];
    };
    [key: string]: unknown;
  };
  community_data?: Record<string, unknown>;
  developer_data?: Record<string, unknown>;
  public_interest_stats?: Record<string, unknown>;
  last_updated: string;
}

interface CoinGeckoMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// Конфиг для диапазонов графиков
const RANGE_CONFIG: Record<
  RangeKey,
  { days: number | 'max'; interval?: 'daily' }
> = {
  // для коротких диапазонов вообще не указываем interval —
  // CoinGecko сам подберёт шаг (почасовой/минутный), который доступен в твоём плане
  h24: { days: 1 },
  d7: { days: 7 },

  // для длинных диапазонов явно просим daily
  d30: { days: 30, interval: 'daily' },
  d90: { days: 90, interval: 'daily' },
  d365: { days: 365, interval: 'daily' },
  max: { days: 'max', interval: 'daily' },
};

@Injectable()
export class CryptoDataFetcherService {
  private readonly log = new Logger(CryptoDataFetcherService.name);
  private readonly apiBaseUrl = 'https://api.coingecko.com/api/v3';
  private readonly apiKey = process.env.COINGECKO_API_KEY ?? '';

  private isRunning = false;

  constructor(
    private readonly cryptoDataWorkerService: CryptoDataWorkerService,
  ) {}

  // ===== CRON =====

  // Лучше не долбить часто, пусть будет раз в час (под себя подстроишь)
  // @Cron('*/1 * * * *')
  async fetchTop200Cron() {
    if (this.isRunning) {
      this.log.warn('Previous fetch run is still in progress, skipping this tick');
      return;
    }

    this.isRunning = true;
    try {
      await this.fetchAndStoreTopAssets(200);
    } catch (e) {
      this.log.error(
        `Cron fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  // Можно вызывать руками из другого места
  async fetchAndStoreTopAssets(limit: number = 10): Promise<void> {
    this.log.log(`Fetching TOP-${limit} assets from CoinGecko API...`);

    // 1. Берём топ-лимит монет через /coins/markets
    const marketCoins = await this.fetchTopMarketCoins({
      vsCurrency: 'usd',
      limit,
    });

    this.log.log(`Got ${marketCoins.length} market coins, start per-coin fetch...`);

    let index = 0;
    for (const coin of marketCoins) {
      index += 1;
      this.log.debug(`[${index}/${marketCoins.length}] Processing ${coin.id} (${coin.symbol.toUpperCase()})`);

      try {
        // 2. Детали монеты
        const details = await this.getCoinDetails(coin.id, {
          localization: false,
          tickers: false,
          marketData: true,
          communityData: false,
          developerData: false,
          sparkline: true,
        });

        // 3. Графики по всем диапазонам
        const charts = await this.fetchChartsForCoin(coin.id, 'usd');

        // 4. Собираем CryptoData по твоему типу
        const cryptoData = this.buildCryptoDataFromApi(coin, details, charts);

        // 5. Пишем в БД через твой сервис
        await this.cryptoDataWorkerService.upsertFromCryptoData(cryptoData);

        this.log.debug(
          `[${index}/${marketCoins.length}] Saved ${cryptoData.assetTicker} (rank=${cryptoData.currentAssetRank})`,
        );
      } catch (err) {
        this.log.warn(
          `[${index}/${marketCoins.length}] Failed to process ${coin.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      // Чуть притормаживаем, чтобы не выстрелить себе в ногу по rate-limit
      await this.sleep(200);
    }

    this.log.log(`Done. Processed ${marketCoins.length} assets.`);
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ API =====

  private async fetchJson<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.apiKey) {
      // как именно передавать ключ — зависит от текущих требований CoinGecko
      headers['x-cg-demo-api-key'] = this.apiKey;
    }

    this.log.debug(`[HTTP] GET ${url}`);
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }

  private async getMarketCoinsPage(params: {
    vsCurrency: VsCurrency;
    page: number;
    perPage: number;
    priceChangePercentages?: string;
  }): Promise<CoinGeckoMarketCoin[]> {
    const {
      vsCurrency,
      page,
      perPage,
      priceChangePercentages = '1h,24h,7d,14d,30d,1y',
    } = params;

    const usp = new URLSearchParams({
      vs_currency: vsCurrency,
      page: String(page),
      per_page: String(perPage),
      order: 'market_cap_desc',
      sparkline: 'false',
    });

    if (priceChangePercentages) {
      usp.set('price_change_percentage', priceChangePercentages);
    }

    const url = `${this.apiBaseUrl}/coins/markets?${usp.toString()}`;
    return this.fetchJson<CoinGeckoMarketCoin[]>(url);
  }

  // забираем топ N монет, учитывая, что per_page <= 250
  private async fetchTopMarketCoins(options: {
    vsCurrency: VsCurrency;
    limit: number;
  }): Promise<CoinGeckoMarketCoin[]> {
    const { vsCurrency, limit } = options;

    const perPage = Math.min(limit, 250);
    const pages = Math.ceil(limit / perPage);

    const result: CoinGeckoMarketCoin[] = [];

    for (let page = 1; page <= pages; page += 1) {
      const coins = await this.getMarketCoinsPage({
        vsCurrency,
        page,
        perPage,
        priceChangePercentages: '1h,24h,7d,14d,30d,1y',
      });

      if (!coins.length) break;

      for (const c of coins) {
        result.push(c);
        if (result.length >= limit) break;
      }

      if (result.length >= limit) break;

      await this.sleep(200);
    }

    return result;
  }

  private async getCoinDetails(
    id: string,
    options?: {
      localization?: boolean;
      tickers?: boolean;
      marketData?: boolean;
      communityData?: boolean;
      developerData?: boolean;
      sparkline?: boolean;
    },
  ): Promise<CoinGeckoCoinDetails> {
    const {
      localization = false,
      tickers = false,
      marketData = true,
      communityData = true,
      developerData = true,
      sparkline = true,
    } = options ?? {};

    const usp = new URLSearchParams({
      localization: String(localization),
      tickers: String(tickers),
      market_data: String(marketData),
      community_data: String(communityData),
      developer_data: String(developerData),
      sparkline: String(sparkline),
    });

    const url = `${this.apiBaseUrl}/coins/${encodeURIComponent(
      id,
    )}?${usp.toString()}`;

    return this.fetchJson<CoinGeckoCoinDetails>(url);
  }

  private async getCoinMarketChart(
    id: string,
    options: {
      vsCurrency: VsCurrency;
      days: number | 'max';
      interval?: 'minutely' | 'hourly' | 'daily';
    },
  ): Promise<CoinGeckoMarketChart> {
    const { vsCurrency, days, interval } = options;

    const usp = new URLSearchParams({
      vs_currency: vsCurrency,
      days: String(days),
    });

    if (interval) {
      usp.set('interval', interval);
    }

    const url = `${this.apiBaseUrl}/coins/${encodeURIComponent(
      id,
    )}/market_chart?${usp.toString()}`;

    return this.fetchJson<CoinGeckoMarketChart>(url);
  }

  // графики по всем RangeKey
  private async fetchChartsForCoin(
    id: string,
    vsCurrency: VsCurrency,
  ): Promise<CryptoCharts> {
    const charts: CryptoCharts = {};

    for (const range of ['h24', 'd7', 'd30', 'd90', 'd365', 'max'] as RangeKey[]) {
      const cfg = RANGE_CONFIG[range];

      try {
        const chart = await this.getCoinMarketChart(id, {
          vsCurrency,
          days: cfg.days,
          interval: cfg.interval,
        });
        await this.sleep(600);

        const payload: ChartPayload = {
          stats: (chart.prices ?? []) as SeriesPoint[],
          total_volumes: (chart.total_volumes ?? []) as SeriesPoint[],
        };

        charts[range] = payload;
      } catch (err) {
        this.log.warn(
          `[charts:${range}] Failed to fetch for ${id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      // не спамим моментально все range подряд
      await this.sleep(100);
    }

    return charts;
  }

  // ===== СБОРКА CryptoData =====

  private buildCryptoDataFromApi(
    market: CoinGeckoMarketCoin,
    details: CoinGeckoCoinDetails,
    charts: CryptoCharts,
  ): CryptoData {
    const assetName = market.name;
    const assetTicker = market.symbol.toUpperCase();

    const currentAssetRank = market.market_cap_rank ?? 0;
    const currentPrice = market.current_price ?? 0;

    const marketCap = market.market_cap ?? 0;
    const fdv = market.fully_diluted_valuation ?? 0;
    const volume24H = market.total_volume ?? 0;

    const circulatingSupply = market.circulating_supply ?? 0;
    const totalSupply = market.total_supply ?? 0;

    const maxSupply: number | string =
      market.max_supply != null ? market.max_supply : '-';

    const change1HUsdPct = market.price_change_percentage_1h_in_currency ?? 0;
    const change24HUsdPct =
      market.price_change_percentage_24h_in_currency ??
      market.price_change_percentage_24h ??
      0;
    const change7DUsdPct = market.price_change_percentage_7d_in_currency ?? 0;
    const change14DUsdPct = market.price_change_percentage_14d_in_currency ?? 0;
    const change30DUsdPct = market.price_change_percentage_30d_in_currency ?? 0;
    const change1YUsdPct = market.price_change_percentage_1y_in_currency ?? 0;

    // описание + категории
    const rawDescriptionHtml = details.description?.en || '';
    const assetDescription = rawDescriptionHtml.trim(); // при желании можешь сюда засунуть свою stripHtmlExceptLinks
    const assetCategories = (details.categories || []).join(';');

    // sparkline7D — используем готовый массив из market_data.sparkline_7d
    let sparkline7D: Sparkline7D | undefined;
    const sparkPrices = details.market_data?.sparkline_7d?.price ?? [];
    if (sparkPrices.length > 0) {
      sparkline7D = { prices: sparkPrices };
    }

    // source — ссылка на страницу монеты на CoinGecko
    const source = `https://www.coingecko.com/en/coins/${market.id}`;

    return {
      assetName,
      assetTicker,
      currentAssetRank,
      currentPrice,

      marketCap,
      fdv,
      circulatingSupply,
      totalSupply,
      maxSupply,
      volume24H,

      change1HUsdPct,
      change24HUsdPct,
      change7DUsdPct,
      change14DUsdPct,
      change30DUsdPct,
      change1YUsdPct,

      assetDescription,
      assetCategories,

      sparkline7D,
      charts,
      // candles пока не тащим, можешь добавить через /ohlc при желании
      candles: undefined,
      source,
    };
  }

  // ===== Утилиты =====

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

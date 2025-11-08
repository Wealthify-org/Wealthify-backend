// базовые типы графиков 
export type SeriesPoint = [number, number];

export type ChartPayload = {
  stats: SeriesPoint[];
  total_volumes: SeriesPoint[];
};

export type RangeKey = 'h24' | 'd7' | 'd30' | 'd90' | 'd365' | 'max';

export type CryptoCharts = Partial<Record<RangeKey, ChartPayload>>;

export type Sparkline7D = {
  prices: number[];
};


export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };
export type CandlesByRange = Partial<Record<RangeKey, Candle[]>>;


export type CryptoData = {
  assetName: string;
  assetTicker: string;
  currentAssetRank: number;
  currentPrice: number;

  marketCap: number;
  fdv: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | string; // может быть числом, или знаком бесконечности, или '-'
  volume24H: number;

  change1HUsdPct: number;
  change24HUsdPct: number;
  change7DUsdPct: number;
  change14DUsdPct: number;
  change30DUsdPct: number;
  change1YUsdPct: number;

  assetDescription: string;
  assetCategories: string;

  sparkline7D?: Sparkline7D;
  charts?: CryptoCharts;
  candles?: CandlesByRange; 
  source: string;
};

export type ExtractedCoinFields = Omit<CryptoData, 'charts' | 'candles' | 'source'>;

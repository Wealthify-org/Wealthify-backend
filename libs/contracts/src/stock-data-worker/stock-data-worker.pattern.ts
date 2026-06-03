export const STOCK_DATA_WORKER_PATTERNS = {
  // HEALTH-паттерн оставлен с прежним значением — на него уже завязан
  // gateway-эндпоинт /stock-data-worker/health.
  HEALTH: 'stock_data_worker_health',

  GET_ASSET_BY_TICKER: 'stockDataWorker.getAssetByTicker',
  LIST_ASSETS: 'stockDataWorker.listAssets',
  GET_CHARTS_BY_TICKER: 'stockDataWorker.getChartsByTicker',
  SEARCH_ASSETS: 'stockDataWorker.searchAssets',
  GET_DESCRIPTION: 'stockDataWorker.getDescription',
} as const;

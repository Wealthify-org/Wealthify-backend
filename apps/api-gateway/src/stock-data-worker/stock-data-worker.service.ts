import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { STOCKS_WORKER_CLIENT } from './constant';
import { STOCK_DATA_WORKER_PATTERNS } from '@libs/contracts/stock-data-worker';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class StockDataWorkerService {
  constructor(
    @Inject(STOCKS_WORKER_CLIENT)
    private readonly workerMs: ClientProxy,
  ) {}

  health() {
    return sendOrThrow(this.workerMs, STOCK_DATA_WORKER_PATTERNS.HEALTH, {});
  }

  getAssetByTicker(ticker: string) {
    return sendOrThrow(this.workerMs, STOCK_DATA_WORKER_PATTERNS.GET_ASSET_BY_TICKER, {
      ticker,
    });
  }

  getChartsByTicker(ticker: string) {
    return sendOrThrow(this.workerMs, STOCK_DATA_WORKER_PATTERNS.GET_CHARTS_BY_TICKER, {
      ticker,
    });
  }

  getDescription(ticker: string) {
    // Первый запрос ходит в Википедию/Wikidata (2-3 сетевых вызова) — даём
    // запас по таймауту; после первого успеха отдаётся мгновенно из БД.
    return sendOrThrow(
      this.workerMs,
      STOCK_DATA_WORKER_PATTERNS.GET_DESCRIPTION,
      { ticker },
      20_000,
    );
  }

  listAssets(limit?: number, offset?: number) {
    const safe = (n?: number) => (typeof n === 'number' && Number.isFinite(n) ? n : undefined);
    return sendOrThrow(this.workerMs, STOCK_DATA_WORKER_PATTERNS.LIST_ASSETS, {
      limit: safe(limit),
      offset: safe(offset),
    });
  }

  searchAssets(query: string, limit?: number) {
    const safeLimit =
      typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined;
    return sendOrThrow(this.workerMs, STOCK_DATA_WORKER_PATTERNS.SEARCH_ASSETS, {
      query,
      limit: safeLimit,
    });
  }
}

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockDataWorkerService } from './stock-data-worker.service';
import { STOCK_DATA_WORKER_PATTERNS } from '@libs/contracts/stock-data-worker';

@Controller()
export class StockDataWorkerController {
  constructor(private readonly stockDataWorkerService: StockDataWorkerService) {}

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.HEALTH)
  health() {
    return this.stockDataWorkerService.health();
  }

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.GET_ASSET_BY_TICKER)
  async getAssetByTicker(@Payload() payload: { ticker: string }) {
    return this.stockDataWorkerService.getAssetByTicker(payload.ticker);
  }

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.LIST_ASSETS)
  async listAssets(@Payload() payload?: { limit?: number; offset?: number }) {
    return this.stockDataWorkerService.listAssets(payload);
  }

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.GET_CHARTS_BY_TICKER)
  async getChartsByTicker(@Payload() payload: { ticker: string }) {
    return this.stockDataWorkerService.getChartsByTicker(payload.ticker);
  }

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.SEARCH_ASSETS)
  async searchAssets(@Payload() payload: { query: string; limit?: number }) {
    return this.stockDataWorkerService.searchAssets(payload);
  }

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.GET_DESCRIPTION)
  async getDescription(@Payload() payload: { ticker: string }) {
    return this.stockDataWorkerService.getDescription(payload.ticker);
  }
}

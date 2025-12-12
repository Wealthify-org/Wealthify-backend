import { Controller} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CRYPTO_DATA_WORKER_PATTERNS } from '@libs/contracts/crypto-data-worker/crypto-data-worker.pattern';
import { CryptoDataWorkerService } from './crypto-data-worker.service';
import { RecentSearchesService } from './recent-searches.service';

@Controller()
export class CryptoDataWorkerController {
  constructor(
    private readonly cryptoDataWorkerService: CryptoDataWorkerService,
    private readonly recentSearchesService: RecentSearchesService
  ) {}

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.HEALTH)
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.GET_ASSET_BY_TICKER)
  async getAssetByTicker(@Payload() payload: { ticker: string }) {
    const asset = await this.cryptoDataWorkerService.getAssetByTicker(payload.ticker);

    return asset?.toJSON();
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.LIST_ASSETS)
  async listAssets(@Payload() payload?: { limit: number; offset?: number }) {
    return this.cryptoDataWorkerService.listAssets(payload);
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.GET_CHARTS_BY_TICKER)
  async getChartsByTicker(@Payload() payload: { ticker: string }) {
    const charts = await this.cryptoDataWorkerService.getChartsByTicker(payload.ticker);

    return charts;
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.SEARCH_ASSETS)
  async searchAssets(@Payload() payload: { query: string; limit?: number }) {
    return this.cryptoDataWorkerService.searchAssets(payload);
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.LIST_RECENT_SEARCHES)
  async listRecentSearches(
    @Payload() payload: { userId: number; limit?: number },
  ) {
    return this.recentSearchesService.list(payload.userId, payload.limit);
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.ADD_RECENT_SEARCH)
  async addRecentSearch(
    @Payload() payload: { userId: number; assetId: number },
  ) {
    await this.recentSearchesService.add(payload.userId, payload.assetId);
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.REMOVE_RECENT_SEARCH)
  async removeRecentSearch(
    @Payload() payload: { userId: number; recentId: number },
  ) {
    await this.recentSearchesService.removeOne(
      payload.userId,
      payload.recentId,
    );
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERNS.CLEAR_RECENT_SEARCHES)
  async clearRecentSearches(@Payload() payload: { userId: number }) {
    await this.recentSearchesService.clear(payload.userId);
  }
}

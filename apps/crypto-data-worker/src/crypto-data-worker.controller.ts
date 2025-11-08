import { Controller, HttpStatus } from '@nestjs/common';
import { CryptoDataScrapperService } from './crypto-data-scrapper.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CRYPTO_DATA_WORKER_PATTERS } from '@libs/contracts/crypto-data-worker/crypto-data-worker.pattern';
import { rpcError } from '@libs/contracts/common';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

@Controller()
export class CryptoDataWorkerController {
  constructor(
    private readonly cryptoDataWorkerService: CryptoDataWorkerService
  ) {}

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERS.HEALTH)
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERS.GET_ASSET_BY_TICKER)
  async getAssetByTicker(@Payload() payload: { ticker: string }) {
    const asset = await this.cryptoDataWorkerService.getAssetByTicker(payload.ticker);

    return asset?.toJSON();
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERS.LIST_ASSETS)
  async listAssets(@Payload() payload?: { limit: number; offset?: number }) {
    return this.cryptoDataWorkerService.listAssets(payload);
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERS.GET_CHARTS_BY_TICKER)
  async getChartsByTicker(@Payload() payload: { ticker: string }) {
    const charts = await this.cryptoDataWorkerService.getChartsByTicker(payload.ticker);

    return charts;
  }
}

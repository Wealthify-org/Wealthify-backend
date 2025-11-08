import { Inject, Injectable } from "@nestjs/common";
import { WORKER_CLIENT } from "./constant";
import { ClientProxy } from "@nestjs/microservices";
import { sendOrThrow } from "@libs/contracts/common/rpc/client";
import { CRYPTO_DATA_WORKER_PATTERS } from "@libs/contracts/crypto-data-worker/crypto-data-worker.pattern";

@Injectable()
export class CryptoDataWorkerService {
  constructor(@Inject(WORKER_CLIENT) private readonly workerMs: ClientProxy) {}

  health() {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERS.HEALTH, {});
  }

  getAssetDataByTicker(ticker: string) {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERS.GET_ASSET_BY_TICKER, { ticker });
  }

  getAssetChartsByTicker(ticker: string) {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERS.GET_CHARTS_BY_TICKER, { ticker });
  }

  listAssets(limit?: number, offset?: number) {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERS.LIST_ASSETS, { limit, offset });
  }
}
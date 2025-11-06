import { Controller, HttpStatus } from '@nestjs/common';
import { CryptoDataScrapperService } from './crypto-data-scrapper.service';
import { MessagePattern } from '@nestjs/microservices';
import { CRYPTO_DATA_WORKER_PATTERS } from '@app/contracts/crypto-data-worker/crypto-data-worker.pattern';
import { rpcError } from '@app/contracts/common';

@Controller()
export class CryptoDataWorkerController {
  constructor(private readonly cryptoDataScrapperService: CryptoDataScrapperService) {}

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERS.HEALTH)
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  @MessagePattern(CRYPTO_DATA_WORKER_PATTERS.COLLECT)
  collectOnce() {
    try {
      return this.cryptoDataScrapperService.collectAllAssetsDataCron();
    } catch (e: any) {
      // Превращаем любую ошибку сервиса в RpcException,
      // чтобы gateway получил корректный status/code/message
      rpcError(
        HttpStatus.BAD_GATEWAY,
        'SCRAPE_FAILED',
        e?.message ?? 'Scrape failed'
      );
    }
  }


}

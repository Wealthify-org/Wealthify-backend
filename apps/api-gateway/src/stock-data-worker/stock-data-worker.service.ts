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
    return sendOrThrow(
      this.workerMs,
      STOCK_DATA_WORKER_PATTERNS.HEALTH,
      {},
    );
  }

  // parseAll() { ... }
}

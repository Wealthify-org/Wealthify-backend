import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { INDEXES_WORKER_CLIENT } from './constant';
import { INDEXES_DATA_WORKER_PATTERNS } from '@libs/contracts/indexes-data-worker';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class IndexesDataWorkerService {
  constructor(
    @Inject(INDEXES_WORKER_CLIENT)
    private readonly workerMs: ClientProxy,
  ) {}

  health() {
    return sendOrThrow(
      this.workerMs,
      INDEXES_DATA_WORKER_PATTERNS.HEALTH,
      {},
    );
  }

  // parseAll() {
  //   return sendOrThrow(this.workerMs, INDEXES_DATA_WORKER_PATTERNS.PARSE_ALL, {});
  // }
}

import { Inject, Injectable } from "@nestjs/common";
import { WORKER_CLIENT } from "./constant";
import { ClientProxy } from "@nestjs/microservices";
import { sendOrThrow } from "@app/contracts/common/rpc/client";
import { CRYPTO_DATA_WORKER_PATTERS } from "@app/contracts/crypto-data-worker/crypto-data-worker.pattern";

@Injectable()
export class CryptoDataWorkerService {
  constructor(@Inject(WORKER_CLIENT) private readonly workerMs: ClientProxy) {}

  health() {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERS.HEALTH, {});
  }

  collectOnce() {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERS.COLLECT, {});
  }
}
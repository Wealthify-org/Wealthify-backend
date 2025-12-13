import { Injectable } from '@nestjs/common';

@Injectable()
export class StockDataWorkerService {
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

}

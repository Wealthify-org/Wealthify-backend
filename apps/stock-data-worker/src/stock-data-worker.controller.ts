import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { StockDataWorkerService } from './stock-data-worker.service';
import { STOCK_DATA_WORKER_PATTERNS } from '@libs/contracts/stock-data-worker';

@Controller()
export class StockDataWorkerController {
  constructor(
    private readonly stockDataWorkerService: StockDataWorkerService,
  ) {}

  @MessagePattern(STOCK_DATA_WORKER_PATTERNS.HEALTH)
  health() {
    return this.stockDataWorkerService.health();
  }

}

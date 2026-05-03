import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IndexesDataWorkerService } from './indexes-data-worker.service';
import { INDEXES_DATA_WORKER_PATTERNS } from '@libs/contracts/indexes-data-worker';

@Controller()
export class IndexesDataWorkerController {
  constructor(
    private readonly indexesDataWorkerService: IndexesDataWorkerService,
  ) {}

  @MessagePattern(INDEXES_DATA_WORKER_PATTERNS.HEALTH)
  health() {
    return this.indexesDataWorkerService.health();
  }

  @MessagePattern(INDEXES_DATA_WORKER_PATTERNS.GET_LATEST_SNAPSHOT)
  getLatestSnapshot() {
    return this.indexesDataWorkerService.getLatestSnapshot();
  }
}

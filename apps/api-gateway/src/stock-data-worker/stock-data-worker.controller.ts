import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StockDataWorkerService } from './stock-data-worker.service';

@ApiTags('Stock Data Worker')
@Controller('stock-data-worker')
export class StockDataWorkerController {
  constructor(
    private readonly stockDataWorkerService: StockDataWorkerService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Проверка стокового воркера' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OK' })
  health() {
    return this.stockDataWorkerService.health();
  }
}

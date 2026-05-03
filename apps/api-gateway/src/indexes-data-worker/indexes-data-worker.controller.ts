import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IndexesDataWorkerService } from './indexes-data-worker.service';

// import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
// @UseGuards(JwtAuthGuard)

@ApiTags('Indexes Data Worker')
@Controller('indexes-data-worker')
export class IndexesDataWorkerController {
  constructor(
    private readonly indexesDataWorkerService: IndexesDataWorkerService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Проверка индексового воркера' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OK' })
  health() {
    return this.indexesDataWorkerService.health();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Последний снэпшот рыночных индексов',
    description:
      'Агрегированная сводка: Fear & Greed, доминация BTC/ETH, Altseason Index, S&P 500, Gold, капитализации TOTAL/TOTAL2/TOTAL3.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Снэпшот получен' })
  getDashboard() {
    return this.indexesDataWorkerService.getDashboard();
  }
}

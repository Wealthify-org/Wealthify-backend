import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CryptoDataWorkerService } from "./crypto-data-worker.service";

@ApiTags('Crypto Data Worker')
@Controller('crypto-data-worker')
export class CryptoDataWorkerController {
  constructor(private readonly cryptoDataWorkerService: CryptoDataWorkerService) {}
  @ApiOperation({ summary: 'Проверка воркера' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OK' })
  @Get('health')
  health() {
    return this.cryptoDataWorkerService.health();
  }


  @ApiOperation({
    summary: 'Получить данные по активу по тикеру',
    description:
      'Возвращает последний снапшот данных по указанному тикеру (цена, капа, изменения, описание и т.д.).',
  })
  @ApiParam({
    name: 'ticker',
    description: 'Тикер актива (нечувствителен к регистру)',
    example: 'BTC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Данные по активу найдены',
    schema: {
      example: {
        ticker: 'BTC',
        name: 'Bitcoin',
        rank: 1,
        currentPriceUsd: 68000.12,
        marketCapUsd: 1340000000000,
        fdvUsd: 1340000000000,
        volume24HUsd: 32000000000,
        change1HUsdPct: 0.52,
        change24HUsdPct: -2.15,
        change7DUsdPct: 5.42,
        sparkline7D: {
          prices: [67000.1, 67125.5, 66543.2],
        },
        lastUpdatedAt: '2025-11-08T10:26:34.123Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Актив с указанным тикером не найден',
  })
  @Get(':ticker')
  async getAssetData(@Param('ticker') ticker: string) {
    return this.cryptoDataWorkerService.getAssetDataByTicker(ticker);
  }

  @ApiOperation({
    summary: 'Получить список активов',
    description:
      'Возвращает пагинированный список криптоактивов, отсортированный по рангу.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Максимальное количество записей (1–200, по умолчанию 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Смещение выборки (для пагинации), по умолчанию 0',
    example: 0,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список активов',
    schema: {
      example: {
        items: [
          {
            ticker: 'BTC',
            name: 'Bitcoin',
            rank: 1,
            currentPriceUsd: 68000.12,
            marketCapUsd: 1340000000000,
          },
          {
            ticker: 'ETH',
            name: 'Ethereum',
            rank: 2,
            currentPriceUsd: 3400.5,
            marketCapUsd: 415000000000,
          },
        ],
        total: 200,
        limit: 50,
        offset: 0,
      },
    },
  })
  @Get()
  async listAssets(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.cryptoDataWorkerService.listAssets(Number(limit), Number(offset));
  }


  @ApiOperation({
    summary: 'Получить данные графиков по тикеру',
    description:
      'Возвращает JSON с данными графиков (h24, d7, d30, d90, d365, max) для указанного актива. Формат точек: [timestamp, value].',
  })
  @ApiParam({
    name: 'ticker',
    description: 'Тикер актива',
    example: 'BTC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Графики для указанного актива',
    schema: {
      example: {
        h24Stats: [
          [1761987725521, 110159.76],
          [1761991274015, 109919.6],
        ],
        h24Volumes: [
          [1761987725521, 123456.78],
          [1761991274015, 234567.89],
        ],
        d7Stats: [
          [1761500000000, 100000.0],
          [1761600000000, 102000.0],
        ],
        d7Volumes: [],
        // и так далее для d30, d90, d365, max
        capturedAt: '2025-11-08T10:26:34.123Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Графики для указанного тикера не найдены',
  })
  @Get(':ticker/charts')
  async getAssetChartsData(@Param('ticker') ticker: string) {
    return this.cryptoDataWorkerService.getAssetChartsByTicker(ticker);
  }
}
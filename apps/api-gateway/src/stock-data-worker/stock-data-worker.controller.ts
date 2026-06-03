import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StockDataWorkerService } from './stock-data-worker.service';

@ApiTags('Stock Data Worker')
@Controller('stock-data-worker')
export class StockDataWorkerController {
  constructor(private readonly stockDataWorkerService: StockDataWorkerService) {}

  @ApiOperation({ summary: 'Проверка стокового воркера' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OK' })
  @Get('health')
  health() {
    return this.stockDataWorkerService.health();
  }

  @ApiOperation({
    summary: 'Получить список акций',
    description:
      'Пагинированный список российских акций (MOEX, доска TQBR), отсортированный по капитализации.',
  })
  @ApiQuery({ name: 'limit', required: false, description: '1–200, по умолчанию 50', example: 50 })
  @ApiQuery({ name: 'offset', required: false, description: 'Смещение, по умолчанию 0', example: 0 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список акций',
    schema: {
      example: {
        items: [
          {
            id: 101,
            secid: 'SBER',
            ticker: 'SBER',
            name: 'Сбербанк России ПАО ао',
            shortName: 'Сбербанк',
            type: 'Stock',
            currency: 'RUB',
            rank: 1,
            currentPrice: 305.12,
            dayChangePct: 0.9,
            marketCap: 6580000000000,
          },
        ],
        total: 250,
        limit: 50,
        offset: 0,
      },
    },
  })
  @Get()
  async listAssets(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.stockDataWorkerService.listAssets(Number(limit), Number(offset));
  }

  @ApiOperation({ summary: 'Поиск акций по тикеру / названию / ISIN' })
  @ApiQuery({ name: 'q', required: true, description: 'Поисковый запрос', example: 'сбер' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  @Get('search')
  async searchAssets(@Query('q') q: string, @Query('limit') limit = '8') {
    const query = q?.trim();
    if (!query || query.length < 2) {
      return { items: [] };
    }
    return this.stockDataWorkerService.searchAssets(query, Number(limit));
  }

  @ApiOperation({
    summary: 'Получить данные графиков по тикеру',
    description:
      'JSON с данными графиков (h24, d7, d30, d90, d365, max) для указанной акции. Формат точек: [timestamp, value].',
  })
  @ApiParam({ name: 'ticker', description: 'Тикер MOEX (secid)', example: 'SBER' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Графики для указанной акции' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Акция не найдена' })
  @Get(':ticker/charts')
  async getAssetChartsData(@Param('ticker') ticker: string) {
    return this.stockDataWorkerService.getChartsByTicker(ticker);
  }

  @ApiOperation({
    summary: 'Получить данные по акции по тикеру',
    description: 'Последний снапшот: цена, капитализация, изменения, объём и т.д.',
  })
  @ApiParam({ name: 'ticker', description: 'Тикер MOEX (нечувствителен к регистру)', example: 'SBER' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Данные по акции найдены' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Акция не найдена' })
  @Get(':ticker')
  async getAssetData(@Param('ticker') ticker: string) {
    return this.stockDataWorkerService.getAssetByTicker(ticker);
  }

  @ApiOperation({
    summary: 'Текстовое описание эмитента',
    description:
      'Описание компании из Википедии (лениво кешируется). Возвращает { description: string | null }.',
  })
  @ApiParam({ name: 'ticker', description: 'Тикер MOEX (secid)', example: 'SBER' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Описание (или null, если статьи нет)' })
  @Get(':ticker/description')
  async getDescription(@Param('ticker') ticker: string) {
    return this.stockDataWorkerService.getDescription(ticker);
  }
}

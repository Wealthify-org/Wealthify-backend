import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CryptoDataWorkerService } from "./crypto-data-worker.service";
import { SearchAssetsHttpResponse } from "@libs/contracts/crypto-data-worker";
import { JwtAuthGuard } from "@gateway/common/guards/jwt-auth.guard";
import { CurrentUser } from "@gateway/common/decorators/сurrent-user.decorator";

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
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      'Фильтр по категории (id из CATEGORY_KEYWORDS): stablecoins, blockchains, l2, defi, liquidStaking, ai, aiAgents, meme, rwa, gaming, depin, privacy, exchangeTokens',
    example: 'ai',
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
  async listAssets(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') category?: string,
  ) {
    const safeCategory = category && category.trim() ? category.trim() : undefined;
    return this.cryptoDataWorkerService.listAssets(
      Number(limit),
      Number(offset),
      safeCategory,
    );
  }

  @Get("search")
  async searchAssets(
    @Query("q") q: string,
    @Query("limit") limit = "8"
  ): Promise<SearchAssetsHttpResponse> {
    const query = q?.trim();

    if (!query || query.length < 2) {
      return { items: [] };
    }

    return this.cryptoDataWorkerService.searchAssets(query, Number(limit))
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

  @ApiOperation({
    summary: "Получить недавние поисковые запросы пользователя",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Максимум записей (по умолчанию 10, максимум — 10)",
    example: 8,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Список недавних поисков",
  })
  @UseGuards(JwtAuthGuard)
  @Get("search/recent")
  async getRecentSearches(
    @CurrentUser("id") userId: number,
    @Query("limit") limit?: string,
  ): Promise<SearchAssetsHttpResponse> {
    return this.cryptoDataWorkerService.getRecentSearches(
      userId,
      limit ? Number(limit) : undefined,
    );
  }

  @ApiOperation({
    summary: "Добавить актив в список недавних поисков",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Запись добавлена",
  })
  @UseGuards(JwtAuthGuard)
  @Post("search/recent")
  async addRecentSearch(
    @CurrentUser("id") userId: number,
    @Body() body: { assetId: number },
  ): Promise<void> {
    await this.cryptoDataWorkerService.addRecentSearch(userId, body.assetId);
  }

  @ApiOperation({
    summary: "Удалить один элемент из списка недавних поисков",
  })
  @ApiParam({
    name: "id",
    description: "ID записи недавнего поиска",
    example: 12,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Запись удалена",
  })
  @UseGuards(JwtAuthGuard)
  @Delete("search/recent/:id")
  async removeRecentSearch(
    @CurrentUser("id") userId: number,
    @Param("id") id: string,
  ): Promise<void> {
    await this.cryptoDataWorkerService.removeRecentSearch(
      userId,
      Number(id),
    );
  }

  @ApiOperation({
    summary: "Очистить все недавние поисковые запросы пользователя",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Список недавних очищен",
  })
  @UseGuards(JwtAuthGuard)
  @Delete("search/recent")
  async clearRecentSearches(
    @CurrentUser("id") userId: number,
  ): Promise<void> {
    await this.cryptoDataWorkerService.clearRecentSearches(userId);
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

}
import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PortfoliosService } from './portfolios.service';
import { CreatePortfolioDto, CreatePortfolioWithoutUserDto } from '@libs/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { CurrentUser } from '@gateway/common/decorators/сurrent-user.decorator';
import { UserPortfoliosSummaryDto } from '@libs/contracts/portfolios/dto/user-portfolios-summary.dto';
import {
  ValueHistoryPeriod,
  VALUE_HISTORY_PERIODS,
} from '@libs/contracts/portfolios/dto/value-history.dto';

@ApiTags('Портфели')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Создание нового портфеля' })
  @ApiBody({ type: CreatePortfolioDto })
  @ApiResponse({ status: 201, description: 'Портфель успешно создан' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации входных данных' })
  create(
    @Body() dto: CreatePortfolioWithoutUserDto, 
    @CurrentUser('id') userId: number,) 
  {
      const payload: CreatePortfolioDto = {
      ...(dto as any),
      userId,
    };

    return this.portfolios.createPortfolio(payload);
  }

  @Get('/user')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить все портфели пользователя по его ID' })
  @ApiParam({ name: 'id', example: 1, description: 'ID пользователя' })
  @ApiResponse({ status: 200, description: 'Список портфелей' })
  getAll(@CurrentUser("id") userId: number) {
    return this.portfolios.getAllPortfolios(userId);
  }

  @Get('/name/:name')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить портфель текущего пользователя по названию' })
  @ApiParam({ name: 'name', example: 'Crypto Portfolio', description: 'Название портфеля' })
  @ApiResponse({ status: 200, description: 'Портфель найден или сообщение об отсутствии' })
  getByName(@Param('name') name: string, @CurrentUser('id') userId: number) {
    // Передаём userId, чтобы сервис ограничил поиск только портфелями
    // вызывающего пользователя (раньше был IDOR — любой залогиненный
    // мог получить чужой портфель по имени).
    return this.portfolios.getPortfolioByName(name, userId);
  }

  @Get('/summary/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({summary: "Сводка по всем портфелям текущего пользователя"})
  @ApiResponse({
    status: 200,
    description: "Баланс и изменение за 24ч USD",
    type: Object,
  })
  getMySummary(@CurrentUser("id") userId: number): Promise<UserPortfoliosSummaryDto> {
    return this.portfolios.getUserSummary(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить детали портфеля по id с активами и метриками' })
  @ApiParam({ name: 'id', example: 1, description: 'ID портфеля' })
  @ApiResponse({ status: 200, description: 'Детали портфеля' })
  @ApiResponse({ status: 404, description: 'Портфель не найден' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  getDetail(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.portfolios.getPortfolioDetailById(Number(id), userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Удалить портфель по ID (только свой)' })
  @ApiParam({ name: 'id', example: 5, description: 'ID портфеля' })
  @ApiResponse({ status: 200, description: 'Портфель успешно удалён' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  @ApiResponse({ status: 404, description: 'Портфель не найден' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: number) {
    // Передаём userId — сервис проверит ownership перед destroy.
    return this.portfolios.deletePortfolio(Number(id), userId);
  }

  @Get(':id/value-history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'История стоимости портфеля во времени',
    description:
      'Считает реальную историю value(t) и invested(t) на основе ' +
      'транзакций пользователя × цен активов из crypto-data-worker. ' +
      'Серия начинается с даты ПЕРВОЙ транзакции (раньше портфель пустой). ' +
      'Период `max` = от первой транзакции до now.',
  })
  @ApiParam({ name: 'id', example: 1, description: 'ID портфеля' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['24h', '7d', '30d', '90d', '1y', 'max'],
    description: 'По умолчанию `1y`',
  })
  @ApiResponse({ status: 200, description: 'Серия точек {ts, value, invested}' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  @ApiResponse({ status: 404, description: 'Портфель не найден' })
  getValueHistory(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Query('period') period?: string,
  ) {
    const safePeriod: ValueHistoryPeriod = VALUE_HISTORY_PERIODS.includes(
      period as ValueHistoryPeriod,
    )
      ? (period as ValueHistoryPeriod)
      : '1y';
    return this.portfolios.getValueHistory(Number(id), userId, safePeriod);
  }

  @Get(':id/recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Получить персонализированные рекомендации по портфелю',
    description:
      'Анализирует структуру портфеля + риск-профиль пользователя через LLM (OpenRouter / Gemma) и возвращает 3–6 actionable-рекомендаций. Если LLM недоступен, возвращается rule-based fallback.',
  })
  @ApiParam({ name: 'id', example: 1, description: 'ID портфеля' })
  @ApiResponse({ status: 200, description: 'Список рекомендаций' })
  @ApiResponse({ status: 404, description: 'Портфель не найден' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  getRecommendations(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Query('lang') lang?: string,
  ) {
    const safeLang = lang === 'en' || lang === 'ru' ? lang : undefined;
    return this.portfolios.getRecommendations(Number(id), userId, safeLang);
  }
}

import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PortfoliosService } from './portfolios.service';
import { CreatePortfolioDto, CreatePortfolioWithoutUserDto } from '@libs/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { CurrentUser } from '@gateway/common/decorators/сurrent-user.decorator';
import { UserPortfoliosSummaryDto } from '@libs/contracts/portfolios/dto/user-portfolios-summary.dto';

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
  @ApiOperation({ summary: 'Получить портфель по названию' })
  @ApiParam({ name: 'name', example: 'Crypto Portfolio', description: 'Название портфеля' })
  @ApiResponse({ status: 200, description: 'Портфель найден или сообщение об отсутствии' })
  getByName(@Param('name') name: string) {
    return this.portfolios.getPortfolioByName(name);
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
  @ApiOperation({ summary: 'Удалить портфель по ID' })
  @ApiParam({ name: 'id', example: 5, description: 'ID портфеля' })
  @ApiResponse({ status: 200, description: 'Портфель успешно удалён' })
  @ApiResponse({ status: 404, description: 'Портфель не найден' })
  delete(@Param('id') id: string) {
    return this.portfolios.deletePortfolio(Number(id));
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
  ) {
    return this.portfolios.getRecommendations(Number(id), userId);
  }
}

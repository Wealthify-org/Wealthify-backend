import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AssetsService } from './assets.service';

import {
  CreateAssetDto,
  AddAssetToPortfolioDto,
  SellAssetDto,
  RemoveAssetFromPortfolioDto,
} from '@libs/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { RolesGuard } from '@gateway/common/guards/roles.guard';
import { Roles } from '@gateway/common/decorators/roles-auth.decorator';

@ApiTags('Активы')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Создание нового актива' })
  @ApiResponse({ status: 201, description: 'Актив успешно создан' })
  @ApiResponse({ status: 400, description: 'Актив с таким тикером уже существует' })
  @ApiBody({ type: CreateAssetDto })
  create(@Body() dto: CreateAssetDto) {
    return this.assets.createAsset(dto);
  }

  @Post('/add-to-portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Добавить актив в портфель' })
  @ApiResponse({ status: 200, description: 'Актив добавлен или обновлён в портфеле' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены' })
  @ApiBody({ type: AddAssetToPortfolioDto })
  addAssetToPortfolio(@Body() dto: AddAssetToPortfolioDto) {
    return this.assets.addAssetToPortfolio(dto);
  }

  @Get(':ticker')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить актив по тикеру' })
  @ApiResponse({ status: 200, description: 'Актив найден' })
  @ApiResponse({ status: 404, description: 'Актив не найден' })
  @ApiParam({ name: 'ticker', description: 'Тикер актива (например, BTC)' })
  getByTicker(@Param('ticker') ticker: string) {
    return this.assets.getAssetByTicker(ticker);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Продать актив из портфеля' })
  @ApiResponse({ status: 200, description: 'Продажа выполнена успешно' })
  @ApiResponse({ status: 400, description: 'Неверное количество или цена продажи' })
  @ApiResponse({ status: 404, description: 'Актив/портфель не найдены либо актив отсутствует в портфеле' })
  @ApiBody({ type: SellAssetDto })
  sellAsset(@Body() dto: SellAssetDto) {
    return this.assets.sellAsset(dto);
  }

  @Delete('remove-from-portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Удалить актив из портфеля' })
  @ApiResponse({ status: 200, description: 'Актив удалён из портфеля' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены' })
  @ApiBody({ type: RemoveAssetFromPortfolioDto })
  removeAssetFromPortfolio(@Body() dto: RemoveAssetFromPortfolioDto) {
    return this.assets.removeAssetFromPortfolio(dto);
  }

  @Delete(':ticker')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Удалить актив по тикеру' })
  @ApiResponse({ status: 200, description: 'Актив и все связанные записи успешно удалены' })
  @ApiResponse({ status: 404, description: 'Актив не найден' })
  @ApiParam({ name: 'ticker', description: 'Тикер удаляемого актива' })
  deleteAsset(@Param('ticker') ticker: string) {
    return this.assets.deleteAssetByTicker(ticker);
  }
}
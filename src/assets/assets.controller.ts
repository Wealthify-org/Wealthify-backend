import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AddAssetToPortfolioDto } from './dto/add-asset-to-portfolio.dto';
import { SellAssetDto } from './dto/sell-asset.dto';
import { RemoveAssetFromPortfolioDto } from './dto/remove-asset-from-portfolio.dto';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Активы')
@Controller('assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Создание нового актива' })
  @ApiResponse({ status: 201, description: 'Актив успешно создан' })
  @ApiResponse({ status: 400, description: 'Актив с таким тикером уже существует' })
  @ApiBody({ type: CreateAssetDto })
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.createAsset(dto)
  }

  @Post('/add-to-portfolio')
  @ApiOperation({ summary: 'Добавить актив в портфель' })
  @ApiResponse({ status: 200, description: 'Актив добавлен или обновлён в портфеле' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены' })
  @ApiBody({ type: AddAssetToPortfolioDto })
  async addAssetToPortfolio(@Body() dto: AddAssetToPortfolioDto) {
    return this.assetsService.addAssetToPortfolio(dto)
  }

  @Get(':ticker')
  @ApiOperation({ summary: 'Получить актив по тикеру' })
  @ApiResponse({ status: 200, description: 'Актив найден' })
  @ApiResponse({ status: 404, description: 'Актив не найден' })
  @ApiParam({ name: 'ticker', description: 'Тикер актива (например, BTC)' })
  getByTicker(@Param('ticker') ticker: string) {
    return this.assetsService.getAssetByTicker(ticker)
  }

  @Patch()
  @ApiOperation({ summary: 'Продать актив из портфеля' })
  @ApiResponse({ status: 200, description: 'Продажа выполнена успешно' })
  @ApiResponse({ status: 400, description: 'Неверное количество или цена продажи' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены, либо актив отсутствует в портфеле' })
  @ApiBody({ type: SellAssetDto })
  sellAsset(@Body() dto: SellAssetDto) {
    return this.assetsService.sellAsset(dto)
  }

  @Delete('remove-from-portfolio')
  @ApiOperation({ summary: 'Удалить актив из портфеля' })
  @ApiResponse({ status: 200, description: 'Актив удалён из портфеля' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены' })
  @ApiBody({ type: RemoveAssetFromPortfolioDto })
  removeAssetFromPortfolio(@Body() dto: RemoveAssetFromPortfolioDto) {
    return this.assetsService.removeAssetFromPortfolio(dto)
  }

  @Delete(':ticker')
  @ApiOperation({ summary: 'Удалить актив по тикеру' })
  @ApiResponse({ status: 200, description: 'Актив и все связанные записи успешно удалены' })
  @ApiResponse({ status: 404, description: 'Актив не найден' })
  @ApiParam({ name: 'ticker', description: 'Тикер удаляемого актива' })
  deleteAsset(@Param('ticker') ticker: string) {
    return this.assetsService.deleteAsset(ticker)
  }
}

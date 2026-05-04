import { Body, Controller, Delete, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PortfolioAssetsService } from './portfolio-assets.service';
import {
  AddAssetToPortfolioDto,
  RemoveAssetFromPortfolioDto,
  SellAssetDto,
} from '@libs/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { CurrentUser } from '@gateway/common/decorators/сurrent-user.decorator';

@ApiTags('Активы в портфеле')
@Controller('portfolio-assets')
export class PortfolioAssetsController {
  constructor(private readonly portfolioAssets: PortfolioAssetsService) {}

  @Post('/add-to-portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Добавить актив в портфель' })
  @ApiResponse({ status: 200, description: 'Актив добавлен или обновлён в портфеле' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены' })
  @ApiBody({ type: AddAssetToPortfolioDto })
  addAssetToPortfolio(
    @Body() dto: AddAssetToPortfolioDto,
    @CurrentUser('id') userId: number,
  ) {
    // userId передаётся из JWT — портфель должен принадлежать вызывающему.
    // Раньше любой залогиненный мог добавлять/мутировать чужие портфели.
    return this.portfolioAssets.addAssetToPortfolio(dto, userId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Продать актив из портфеля' })
  @ApiResponse({ status: 200, description: 'Продажа выполнена успешно' })
  @ApiResponse({ status: 400, description: 'Неверное количество или цена продажи' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  @ApiResponse({
    status: 404,
    description: 'Актив/портфель не найдены либо актив отсутствует в портфеле',
  })
  @ApiBody({ type: SellAssetDto })
  sellAsset(@Body() dto: SellAssetDto, @CurrentUser('id') userId: number) {
    return this.portfolioAssets.sellAsset(dto, userId);
  }

  @Delete('remove-from-portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Удалить актив из портфеля' })
  @ApiResponse({ status: 200, description: 'Актив удалён из портфеля' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  @ApiResponse({ status: 404, description: 'Актив или портфель не найдены' })
  @ApiBody({ type: RemoveAssetFromPortfolioDto })
  removeAssetFromPortfolio(
    @Body() dto: RemoveAssetFromPortfolioDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.portfolioAssets.removeAssetFromPortfolio(dto, userId);
  }
}

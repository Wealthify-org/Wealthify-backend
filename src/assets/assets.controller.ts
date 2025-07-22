import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AddAssetToPortfolioDto } from './dto/add-asset-to-portfolio.dto';
import { SellAssetDto } from './dto/sell-asset.dto';
import { RemoveAssetFromPortfolioDto } from './dto/remove-asset-from-portfolio.dto';

@Controller('assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.createAsset(dto)
  }

  @Post('/add-to-portfolio')
  async addAssetToPortfolio(@Body() dto: AddAssetToPortfolioDto) {
    return this.assetsService.addAssetToPortfolio(dto)
  }

  @Get(':ticker')
  getByTicker(@Param('ticker') ticker: string) {
    return this.assetsService.getAssetByTicker(ticker)
  }

  @Patch()
  sellAsset(@Body() dto: SellAssetDto) {
    return this.assetsService.sellAsset(dto)
  }

  @Delete('remove-from-portfolio')
  removeAssetFromPortfolio(@Body() dto: RemoveAssetFromPortfolioDto) {
    return this.assetsService.removeAssetFromPortfolio(dto)
  }

  @Delete(':ticker')
  deleteAsset(@Param('ticker') ticker: string) {
    return this.assetsService.deleteAsset(ticker)
  }
}

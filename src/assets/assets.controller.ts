import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AddAssetToPortfolioDto } from './dto/add-asset-to-portfolio.dto';

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

  @Get()
  getByTicker(@Query('ticker') ticker: string) {
    return this.assetsService.getAssetByTicker(ticker)
  }
}

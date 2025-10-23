import { Controller } from '@nestjs/common';
import { AssetsService } from './assets.service';
import {
  CreateAssetDto,
  AddAssetToPortfolioDto,
  SellAssetDto,
  RemoveAssetFromPortfolioDto,
} from "@app/contracts";
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ASSETS_PATTERNS } from '@app/contracts/assets/assets.pattern';

@Controller()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @MessagePattern(ASSETS_PATTERNS.CREATE)
  create(@Payload() dto: CreateAssetDto) {
    return this.assetsService.createAsset(dto)
  }

  @MessagePattern(ASSETS_PATTERNS.ADD_TO_PORTFOLIO)
  async addAssetToPortfolio(@Payload() dto: AddAssetToPortfolioDto) {
    return this.assetsService.addAssetToPortfolio(dto)
  }

  @MessagePattern(ASSETS_PATTERNS.GET_BY_TICKER)
  getByTicker(@Payload() payload: { ticker: string }) {
    return this.assetsService.getAssetByTicker(payload.ticker)
  }

  @MessagePattern(ASSETS_PATTERNS.SELL_FROM_PORTFOLIO)
  sellAsset(@Payload() dto: SellAssetDto) {
    return this.assetsService.sellAsset(dto)
  }

  @MessagePattern(ASSETS_PATTERNS.REMOVE_FROM_PORTFOLIO)
  removeAssetFromPortfolio(@Payload() dto: RemoveAssetFromPortfolioDto) {
    return this.assetsService.removeAssetFromPortfolio(dto)
  }

  @MessagePattern(ASSETS_PATTERNS.DELETE_BY_TICKER)
  deleteAsset(@Payload() payload: { ticker: string }) {
    return this.assetsService.deleteAsset(payload.ticker)
  }
}

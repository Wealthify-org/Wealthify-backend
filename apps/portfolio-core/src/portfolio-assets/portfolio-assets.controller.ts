import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  AddAssetToPortfolioDto,
  RemoveAssetFromPortfolioDto,
  SellAssetDto,
} from "@libs/contracts";
import { PortfolioAssetsService } from "./portfolio-assets.service";
import { PORTFOLIO_ASSETS_PATTERNS } from "@libs/contracts/portfolio-assets/portfolio-assets.pattern";

@Controller()
export class PortfolioAssetsController {
  constructor(
    private readonly portfolioAssetsService: PortfolioAssetsService,
  ) {}

  @MessagePattern(PORTFOLIO_ASSETS_PATTERNS.ADD_TO_PORTFOLIO)
  addAssetToPortfolio(@Payload() dto: AddAssetToPortfolioDto) {
    return this.portfolioAssetsService.addAssetToPortfolio(dto);
  }

  @MessagePattern(PORTFOLIO_ASSETS_PATTERNS.SELL_FROM_PORTFOLIO)
  sellAsset(@Payload() dto: SellAssetDto) {
    return this.portfolioAssetsService.sellAsset(dto);
  }

  @MessagePattern(PORTFOLIO_ASSETS_PATTERNS.REMOVE_FROM_PORTFOLIO)
  removeAssetFromPortfolio(
    @Payload() dto: RemoveAssetFromPortfolioDto,
  ) {
    return this.portfolioAssetsService.removeAssetFromPortfolio(dto);
  }
}

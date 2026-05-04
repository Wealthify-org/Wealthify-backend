import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import {
  AddAssetToPortfolioDto,
  RemoveAssetFromPortfolioDto,
  SellAssetDto,
} from "@libs/contracts";
import { PortfolioAssetsService } from "./portfolio-assets.service";
import { PORTFOLIO_ASSETS_PATTERNS } from "@libs/contracts/portfolio-assets/portfolio-assets.pattern";

/**
 * Принимаем расширенный payload с userId — он добавляется gateway-сервисом
 * после проверки JWT и используется для ownership-check на стороне сервиса.
 * DTO от клиента userId не содержит.
 */
type WithUser<T> = T & { userId: number };

@Controller()
export class PortfolioAssetsController {
  constructor(
    private readonly portfolioAssetsService: PortfolioAssetsService,
  ) {}

  @MessagePattern(PORTFOLIO_ASSETS_PATTERNS.ADD_TO_PORTFOLIO)
  addAssetToPortfolio(
    @Payload() payload: WithUser<AddAssetToPortfolioDto>,
  ) {
    const { userId, ...dto } = payload;
    return this.portfolioAssetsService.addAssetToPortfolio(dto, userId);
  }

  @MessagePattern(PORTFOLIO_ASSETS_PATTERNS.SELL_FROM_PORTFOLIO)
  sellAsset(@Payload() payload: WithUser<SellAssetDto>) {
    const { userId, ...dto } = payload;
    return this.portfolioAssetsService.sellAsset(dto, userId);
  }

  @MessagePattern(PORTFOLIO_ASSETS_PATTERNS.REMOVE_FROM_PORTFOLIO)
  removeAssetFromPortfolio(
    @Payload() payload: WithUser<RemoveAssetFromPortfolioDto>,
  ) {
    const { userId, ...dto } = payload;
    return this.portfolioAssetsService.removeAssetFromPortfolio(dto, userId);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { PORTFOLIO_CLIENT } from './constant';
import { PORTFOLIO_ASSETS_PATTERNS } from '@libs/contracts/portfolio-assets/portfolio-assets.pattern';
import {
  AddAssetToPortfolioDto,
  RemoveAssetFromPortfolioDto,
  SellAssetDto,
} from '@libs/contracts';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class PortfolioAssetsService {
  constructor(
    @Inject(PORTFOLIO_CLIENT) private readonly portfolioMs: ClientProxy,
  ) {}

  addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    return sendOrThrow(
      this.portfolioMs,
      PORTFOLIO_ASSETS_PATTERNS.ADD_TO_PORTFOLIO,
      dto,
    );
  }

  sellAsset(dto: SellAssetDto) {
    return sendOrThrow(
      this.portfolioMs,
      PORTFOLIO_ASSETS_PATTERNS.SELL_FROM_PORTFOLIO,
      dto,
    );
  }

  removeAssetFromPortfolio(dto: RemoveAssetFromPortfolioDto) {
    return sendOrThrow(
      this.portfolioMs,
      PORTFOLIO_ASSETS_PATTERNS.REMOVE_FROM_PORTFOLIO,
      dto,
    );
  }
}

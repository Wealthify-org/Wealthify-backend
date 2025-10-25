import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { APP_CLIENT } from './constant';
import { ASSETS_PATTERNS } from '@app/contracts/assets/assets.pattern';

import {
  CreateAssetDto,
  AddAssetToPortfolioDto,
  SellAssetDto,
  RemoveAssetFromPortfolioDto,
} from '@app/contracts';
import { sendOrThrow } from '@app/contracts/common/rpc/client';

@Injectable ()
export class AssetsService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createAsset(dto: CreateAssetDto) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.CREATE, dto)
  }

  addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.ADD_TO_PORTFOLIO, dto);
  }

   getAssetByTicker(ticker: string) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.GET_BY_TICKER, { ticker });
  }

  sellAsset(dto: SellAssetDto) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.SELL_FROM_PORTFOLIO, dto);
  }

  removeAssetFromPortfolio(dto: RemoveAssetFromPortfolioDto) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.REMOVE_FROM_PORTFOLIO, dto);
  }

  deleteAssetByTicker(ticker: string) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.DELETE_BY_TICKER, { ticker });
  }
}
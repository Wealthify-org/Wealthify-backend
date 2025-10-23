import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from './constant';
import { ASSETS_PATTERNS } from '@app/contracts/assets/assets.pattern';

import {
  CreateAssetDto,
  AddAssetToPortfolioDto,
  SellAssetDto,
  RemoveAssetFromPortfolioDto,
} from '@app/contracts';

@Injectable ()
export class AssetsService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createAsset(dto: CreateAssetDto) {
    return firstValueFrom(
      this.appMs.send(
        ASSETS_PATTERNS.CREATE, 
        dto
      )
    );
  }

  addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    return firstValueFrom(
      this.appMs.send(
        ASSETS_PATTERNS.ADD_TO_PORTFOLIO, 
        dto
      )
    );
  }

   getAssetByTicker(ticker: string) {
    return firstValueFrom(
      this.appMs.send(
        ASSETS_PATTERNS.GET_BY_TICKER, 
        { ticker }
      ),
    );
  }

  sellAsset(dto: SellAssetDto) {
    return firstValueFrom(
      this.appMs.send(
        ASSETS_PATTERNS.SELL_FROM_PORTFOLIO, 
        dto
      )
    );
  }

  removeAssetFromPortfolio(dto: RemoveAssetFromPortfolioDto) {
    return firstValueFrom(
      this.appMs.send(
        ASSETS_PATTERNS.REMOVE_FROM_PORTFOLIO, 
        dto
      )
    );
  }

  deleteAssetByTicker(ticker: string) {
    return firstValueFrom(
      this.appMs.send(
        ASSETS_PATTERNS.DELETE_BY_TICKER, 
        { ticker }
      ),
    );
  }
}
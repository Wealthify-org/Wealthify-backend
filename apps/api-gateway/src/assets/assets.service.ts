import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { ASSETS_CLIENT } from './constant';
import { ASSETS_PATTERNS } from '@libs/contracts/assets/assets.pattern';

import {
  CreateAssetDto,
} from '@libs/contracts';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable ()
export class AssetsService {
  constructor(@Inject(ASSETS_CLIENT) private readonly appMs: ClientProxy) {}

  createAsset(dto: CreateAssetDto) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.CREATE, dto)
  }

  getAssetByTicker(ticker: string) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.GET_BY_TICKER, { ticker });
  }

  deleteAssetByTicker(ticker: string) {
    return sendOrThrow(this.appMs, ASSETS_PATTERNS.DELETE_BY_TICKER, { ticker });
  }
}
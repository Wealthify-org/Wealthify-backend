import { Controller } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from "@libs/contracts";
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ASSETS_PATTERNS } from '@libs/contracts/assets/assets.pattern';

@Controller()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @MessagePattern(ASSETS_PATTERNS.CREATE)
  create(@Payload() dto: CreateAssetDto) {
    return this.assetsService.createAsset(dto)
  }

  @MessagePattern(ASSETS_PATTERNS.GET_MANY_BY_IDS)
  getManyByIds(@Payload() data: { ids: number[] }) {
    return this.assetsService.getAssetsByIds(data.ids);
  }

  @MessagePattern(ASSETS_PATTERNS.GET_BY_TICKER)
  getByTicker(@Payload() payload: { ticker: string }) {
    return this.assetsService.getAssetByTicker(payload.ticker)
  }

  @MessagePattern(ASSETS_PATTERNS.DELETE_BY_TICKER)
  deleteAsset(@Payload() payload: { ticker: string }) {
    return this.assetsService.deleteAsset(payload.ticker)
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { sendOrThrow } from "@libs/contracts/common/rpc/client";
import { USER_ACTIVITY_PATTERNS, FavoriteAssetDto } from "@libs/contracts";
import { IDENTITY_CLIENT } from "./constant";

@Injectable()
export class FavoritesService {
  constructor(@Inject(IDENTITY_CLIENT) private readonly appMs: ClientProxy) {}

  add(dto: FavoriteAssetDto) {
    return sendOrThrow(this.appMs, USER_ACTIVITY_PATTERNS.FAVORITES_ADD, dto);
  }

  remove(dto: FavoriteAssetDto) {
    return sendOrThrow(this.appMs, USER_ACTIVITY_PATTERNS.FAVORITES_REMOVE, dto);
  }

  toggle(dto: FavoriteAssetDto) {
    return sendOrThrow(this.appMs, USER_ACTIVITY_PATTERNS.FAVORITES_TOGGLE, dto);
  }

  listIds(userId: number) {
    return sendOrThrow(this.appMs, USER_ACTIVITY_PATTERNS.FAVORITES_LIST_IDS, { userId });
  }

  isFavorite(dto: FavoriteAssetDto) {
    return sendOrThrow(this.appMs, USER_ACTIVITY_PATTERNS.FAVORITES_IS_FAVORITE, dto);
  }
}

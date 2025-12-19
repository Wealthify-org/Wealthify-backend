import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { FavoritesService } from "./favorites.service";
import { USER_ACTIVITY_PATTERNS } from "@libs/contracts";

@Controller()
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @MessagePattern(USER_ACTIVITY_PATTERNS.FAVORITES_ADD)
  add(@Payload() p: { userId: number; assetId: number }) {
    return this.favorites.add(p.userId, p.assetId);
  }

  @MessagePattern(USER_ACTIVITY_PATTERNS.FAVORITES_REMOVE)
  remove(@Payload() p: { userId: number; assetId: number }) {
    return this.favorites.remove(p.userId, p.assetId);
  }

  @MessagePattern(USER_ACTIVITY_PATTERNS.FAVORITES_TOGGLE)
  toggle(@Payload() p: { userId: number; assetId: number }) {
    return this.favorites.toggle(p.userId, p.assetId);
  }

  @MessagePattern(USER_ACTIVITY_PATTERNS.FAVORITES_LIST_IDS)
  listIds(@Payload() p: { userId: number }) {
    return this.favorites.listIds(p.userId);
  }

  @MessagePattern(USER_ACTIVITY_PATTERNS.FAVORITES_IS_FAVORITE)
  isFavorite(@Payload() p: { userId: number; assetId: number }) {
    return this.favorites.isFavorite(p.userId, p.assetId);
  }
}

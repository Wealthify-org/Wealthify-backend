import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { FavoriteAsset } from "./favorite-asset.model";
import { FavoritesService } from "./favorites.service";
import { FavoritesController } from "./favorites.controller";

@Module({
  imports: [
    SequelizeModule.forFeature([
      FavoriteAsset
    ])
],
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService],
})
export class FavoritesModule {}

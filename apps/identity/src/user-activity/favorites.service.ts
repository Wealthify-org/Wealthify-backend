import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { FavoriteAsset } from "./favorite-asset.model";

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(FavoriteAsset)
    private readonly favRepo: typeof FavoriteAsset,
  ) {}

  async add(userId: number, assetId: number) {
    await this.favRepo.findOrCreate({ where: { userId, assetId } });
    return { ok: true as const };
  }

  async remove(userId: number, assetId: number) {
    await this.favRepo.destroy({ where: { userId, assetId } });
    return { ok: true as const };
  }

  async toggle(userId: number, assetId: number) {
    const exists = await this.favRepo.findOne({ where: { userId, assetId } });

    if (exists) {
      await exists.destroy();
      return { ok: true as const, isFavorite: false };
    }

    await this.favRepo.create({ userId, assetId });
    return { ok: true as const, isFavorite: true };
  }

  async listIds(userId: number) {
    const rows = await this.favRepo.findAll({
      where: { userId },
      attributes: ["assetId"],
      order: [["createdAt", "DESC"]],
    });

    return { ids: rows.map((r) => r.assetId) };
  }

  async isFavorite(userId: number, assetId: number) {
    const found = await this.favRepo.findOne({ where: { userId, assetId } });
    return { isFavorite: Boolean(found) };
  }
}

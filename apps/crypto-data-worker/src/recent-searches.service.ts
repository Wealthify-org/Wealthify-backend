import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { RecentSearch } from "@libs/crypto-data/models/recent-search.model";
import { Asset } from "@libs/crypto-data/models/asset.model";
import { CryptoAssetData } from "@libs/crypto-data/models/crypto-asset-data.model";
import { SearchAssetDto, SearchAssetsHttpResponse } from "@libs/contracts/crypto-data-worker";

@Injectable()
export class RecentSearchesService {
  private readonly log = new Logger(RecentSearchesService.name);
  private readonly MAX_RECENT = 10;

  constructor(
    @InjectModel(RecentSearch)
    private readonly recentRepo: typeof RecentSearch,
    @InjectModel(Asset)
    private readonly assetRepo: typeof Asset,
    @InjectModel(CryptoAssetData)
    private readonly cryptoRepo: typeof CryptoAssetData,
  ) {}

  async add(userId: number, assetId: number): Promise<void> {
    // удаляем старую запись для этого актива
    await this.recentRepo.destroy({
      where: { userId, assetId },
    });


    await this.recentRepo.create({
      userId,
      assetId,
    });

    // подчищаем, чтобы было не больше MAX_RECENT
    const count = await this.recentRepo.count({ where: { userId } });
    if (count > this.MAX_RECENT) {
      const toDelete = await this.recentRepo.findAll({
        where: { userId },
        order: [["createdAt", "ASC"]],
        limit: count - this.MAX_RECENT,
      });

      if (toDelete.length) {
        const ids = toDelete.map((r) => r.id);
        await this.recentRepo.destroy({
          where: { id: { [Op.in]: ids } },
        });
      }
    }
  }

  async list(
    userId: number,
    limit?: number,
  ): Promise<SearchAssetsHttpResponse> {
    const safeLimit =
      limit && limit > 0 && limit <= this.MAX_RECENT
        ? limit
        : this.MAX_RECENT;

    const recents = await this.recentRepo.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit: safeLimit,
      include: [
        {
          model: Asset,
          include: [CryptoAssetData],
        },
      ],
    });

    const items: SearchAssetDto[] =
      recents
        .map((r): SearchAssetDto | null => {
          const asset = r.asset;
          const data = asset?.assetData as CryptoAssetData | undefined;

          if (!asset || !data) return null;

          return {
            id: asset.id,
            name: asset.name,
            ticker: asset.ticker,
            logoUrlLocal: data.logoUrlLocal ?? null,
            rank: data.rank ?? null,
            currentPriceUsd: data.currentPriceUsd ?? null,
            change24HUsdPct: data.change24HUsdPct ?? null,
            categories: data.categories ?? null,
            contractAddress: (data as unknown as { contractAddress?: string | null })
          .contractAddress ?? null,
          };
        })
        .filter((item): item is SearchAssetDto => item !== null);

    return { items };
  }

  async removeOne(userId: number, recentId: number): Promise<void> {
    await this.recentRepo.destroy({
      where: { id: recentId, userId },
    });
  }

  async clear(userId: number): Promise<void> {
    await this.recentRepo.destroy({ where: { userId } });
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, QueryTypes } from "sequelize";
import { RecentSearch } from "@libs/crypto-data/models/recent-search.model";
import { Asset } from "@libs/crypto-data/models/asset.model";
import { CryptoAssetData } from "@libs/crypto-data/models/crypto-asset-data.model";
import { AssetType } from "@libs/contracts";
import { SearchAssetDto, SearchAssetsHttpResponse } from "@libs/contracts/crypto-data-worker";

// Минимальный набор полей акции, который нам нужен для карточки «недавних».
// Тянем сырым SQL из таблицы stock_assets (её модель живёт в stock-data-worker
// и НЕ зарегистрирована здесь намеренно: этот воркер поднимается с
// sync:{alter:true}, и регистрация частичной модели снесла бы недостающие
// колонки. Чтение сырым запросом — безопасно и без побочных эффектов).
type StockRecentRow = {
  assetId: number;
  secid: string | null;
  name: string | null;
  shortName: string | null;
  isin: string | null;
  logoUrl: string | null;
  rank: number | null;
  currentPrice: number | null;
  dayChangePct: number | null;
};

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
      // LEFT JOIN на CryptoAssetData — для акций он будет null, и это норм:
      // акции догидрируем отдельным запросом ниже.
      include: [
        {
          model: Asset,
          include: [CryptoAssetData],
        },
      ],
    });

    // Собираем assetId акций — те записи, чей asset помечен type=Stock.
    const stockAssetIds = recents
      .filter((r) => r.asset && r.asset.type === AssetType.STOCK)
      .map((r) => r.assetId);

    const stockMap = await this.loadStockMap(stockAssetIds);

    const items: SearchAssetDto[] =
      recents
        .map((r): SearchAssetDto | null => {
          const asset = r.asset;
          if (!asset) return null;

          // ── акция ──
          if (asset.type === AssetType.STOCK) {
            const s = stockMap.get(asset.id);
            if (!s) return null; // нет снапшота акции — пропускаем (не мусорим)
            return {
              id: asset.id,
              kind: "stock",
              name: s.shortName || s.name || asset.name,
              ticker: s.secid || asset.ticker,
              logoUrlLocal: s.logoUrl ?? null,
              isin: s.isin ?? null,
              rank: s.rank ?? null,
              // цена в RUB — фронт нарисует символ ₽ по kind
              currentPriceUsd: s.currentPrice ?? null,
              change24HUsdPct: s.dayChangePct ?? null,
              categories: null,
              contractAddress: null,
            };
          }

          // ── крипта (и всё остальное, у чего есть CryptoAssetData) ──
          const data = asset.assetData as CryptoAssetData | undefined;
          if (!data) return null;

          return {
            id: asset.id,
            kind: "crypto",
            name: asset.name,
            ticker: asset.ticker,
            logoUrlLocal: data.logoUrlLocal ?? null,
            isin: null,
            rank: data.rank ?? null,
            currentPriceUsd: data.currentPriceUsd ?? null,
            change24HUsdPct: data.change24HUsdPct ?? null,
            categories: data.categories ?? null,
            contractAddress:
              (data as unknown as { contractAddress?: string | null })
                .contractAddress ?? null,
          };
        })
        .filter((item): item is SearchAssetDto => item !== null);

    return { items };
  }

  /**
   * Догидрируем снапшоты акций по списку assetId сырым read-only запросом к
   * таблице stock_assets (см. комментарий к StockRecentRow — почему не модель).
   * Возвращаем Map assetId → строка. На любой ошибке — пустая Map (акции просто
   * не покажутся, но крипто-недавние не падают).
   */
  private async loadStockMap(
    assetIds: number[],
  ): Promise<Map<number, StockRecentRow>> {
    const map = new Map<number, StockRecentRow>();
    if (!assetIds.length) return map;

    try {
      const rows = await this.recentRepo.sequelize!.query<StockRecentRow>(
        `SELECT "assetId", "secid", "name", "shortName", "isin",
                "logoUrl", "rank", "currentPrice", "dayChangePct"
           FROM "stock_assets"
          WHERE "assetId" IN (:ids)`,
        {
          replacements: { ids: assetIds },
          type: QueryTypes.SELECT,
        },
      );
      for (const row of rows) {
        map.set(Number(row.assetId), row);
      }
    } catch (e) {
      this.log.warn(
        `[recent] stock hydrate failed: ${(e as Error)?.message ?? e}`,
      );
    }
    return map;
  }

  /**
   * Удалить одну запись из «недавних» по `assetId` (а не по recent_searches.id).
   * Так фронт может удалить элемент, имея только `asset.id` — не приходится
   * прокидывать ещё одно поле recentId через SearchAssetDto.
   *
   * Если у пользователя по какой-то причине несколько недавних на тот же
   * assetId (исторический мусор) — удалятся все, что корректно.
   */
  async removeOne(userId: number, assetId: number): Promise<void> {
    await this.recentRepo.destroy({
      where: { assetId, userId },
    });
  }

  async clear(userId: number): Promise<void> {
    await this.recentRepo.destroy({ where: { userId } });
  }
}

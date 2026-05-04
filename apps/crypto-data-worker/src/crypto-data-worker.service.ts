import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { CryptoAssetCreationAttrs, CryptoAssetData, CryptoChartsData } from "@libs/crypto-data/models";
import { Asset } from '../../../libs/crypto-data/models/asset.model';
import { Op, Sequelize, literal } from "sequelize";
import { AssetType, ChartPayload, CryptoData, RangeKey, SeriesPoint } from "@libs/contracts";
import { rpcError } from "@libs/contracts/common";
import {
  SearchAssetDto,
  SearchAssetsHttpResponse,
  SearchAssetsParams,
  buildCategoryIlikePatterns,
  getAssetCategoryIds,
  parseCategoriesString,
} from "@libs/contracts/crypto-data-worker";


@Injectable()
export class CryptoDataWorkerService {
  private readonly log = new Logger(CryptoDataWorkerService.name);
  constructor(
    @InjectModel(CryptoAssetData)
    private readonly cryptoAssetRepo: typeof CryptoAssetData,
    @InjectModel(CryptoChartsData)
    private readonly chartsRepo: typeof CryptoChartsData,
    @InjectModel(Asset)
    private readonly assetRepo: typeof Asset,
    @InjectConnection()
    private readonly sequelize: Sequelize,
  ) {}

  // ЧТЕНИЕ ДАННЫХ
  /* TODO: Перенести операции чтения в отдельный микросервис с активами как crypto-data-reader*/
  async getAssetByTicker(ticker: string) {
    const upper = ticker.toUpperCase();

    const assetData = await this.cryptoAssetRepo.findOne({
      where: {ticker: upper},
      include: [
        { model: this.assetRepo, required: false }
      ],
    });

    if (!assetData) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'ASSET_NOT_FOUND',
        `Asset with ticker ${upper} not found`,
      );
    }

    return assetData;
  }

  async listAssets(params?: { limit?: number; offset?: number; category?: string }) {
    const limit =
      params?.limit && params.limit > 0 && params.limit <= 200 ? params.limit : 50;
    const offset = params?.offset && params.offset >= 0 ? params.offset : 0;

    // ── фильтр по категории ─────────────────────────────────────────────
    // Маппим id категории (e.g. "ai") на набор ILIKE-паттернов с учётом
    // границ ';' — чтобы "meme" не зацепил "AI Memes".
    let where: any = undefined;
    if (params?.category) {
      const patterns = buildCategoryIlikePatterns(params.category);
      if (patterns.length) {
        where = {
          categories: {
            [Op.or]: patterns.map((p) => ({ [Op.iLike]: p })),
          },
        };
      }
    }

    // attributes: ограничиваем колонки (отбрасываем тяжёлый description).
    // Include на Asset убран — в маппинге ниже он не использовался,
    // а JOIN на каждый list-запрос — лишняя работа.
    const { rows, count } = await this.cryptoAssetRepo.findAndCountAll({
      where,
      limit,
      offset,
      order: [["rank", "ASC"]],
      attributes: [
        "id",
        "assetId",
        "name",
        "ticker",
        "logoUrlLocal",
        "rank",
        "currentPriceUsd",
        "change1HUsdPct",
        "change24HUsdPct",
        "change7DUsdPct",
        "change30DUsdPct",
        "change1YUsdPct",
        "marketCapUsd",
        "fdvUsd",
        "volume24HUsd",
        "sparkline7D",
        "categories",
      ],
    });

    const items = rows.map((row) => ({
      id: row.assetId,
      name: row.name,
      ticker: row.ticker,
      logoUrlLocal: row.logoUrlLocal ?? null,
      rank: row.rank ?? null,
      currentPriceUsd: row.currentPriceUsd ?? null,
      change1HUsdPct: row.change1HUsdPct ?? null,
      change24HUsdPct: row.change24HUsdPct ?? null,
      change7DUsdPct: row.change7DUsdPct ?? null,
      change30DUsdPct: row.change30DUsdPct ?? null,
      change1YUsdPct: row.change1YUsdPct ?? null,
      marketCapUsd: row.marketCapUsd ?? null,
      fdvUsd: row.fdvUsd ?? null,
      volume24HUsd: row.volume24HUsd ?? null,
      sparkline7D: row.sparkline7D ?? null,
      // сырые теги (для tooltips/UI), и наши id (для фильтра на клиенте)
      categories: parseCategoriesString(row.categories),
      categoryIds: getAssetCategoryIds(row.categories),
    }));

    return {
      items,
      total: count,
      limit,
      offset,
    };
  }

  async getChartsByTicker(ticker: string) {
    const upper = ticker.toUpperCase();

    const assetData = await this.cryptoAssetRepo.findOne({
      where: { ticker: upper },
      include: [{ model: this.chartsRepo, required: false }],
    });

    if (!assetData) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'ASSET_NOT_FOUND',
        `Asset with ticker ${upper} not found`,
      );
    }

    return assetData.charts ?? null;
  }

  async searchAssets(params: SearchAssetsParams): Promise<SearchAssetsHttpResponse> {
    const rawQuery = params.query?.trim();
    if (!rawQuery) {
      return { items: [] };
    }

    const limit = params.limit && params.limit > 0 && params.limit <= 50 ? params.limit : 10;

    const q = rawQuery;
    const ilike = `%${q}%`;

    // SQL-injection-safe ORDER BY: вместо интерполяции пользовательского
    // ввода в literal() — используем replacements (Sequelize escape'ит).
    // Plus include на Asset убран (не использовался в маппинге ниже).
    const rows = await this.cryptoAssetRepo.findAll({
      limit,
      where: {
        [Op.or]: [
          { ticker: { [Op.iLike]: ilike } },
          { name: { [Op.iLike]: ilike } },
          { categories: { [Op.iLike]: ilike } },
          { contractAddress: { [Op.iLike]: ilike } },
        ],
      },
      order: [
        [
          literal(`CASE
            WHEN "CryptoAssetData"."ticker" ILIKE :exact THEN 0
            WHEN "CryptoAssetData"."ticker" ILIKE :prefix THEN 1
            WHEN "CryptoAssetData"."contractAddress" ILIKE :exact THEN 2
            ELSE 3
          END`),
          "ASC",
        ],
        ["rank", "ASC"],
      ],
      replacements: { exact: q, prefix: `${q}%` },
    });

    const items: SearchAssetDto[] = rows.map((row) => ({
      id: row.assetId,
      name: row.name,
      ticker: row.ticker,
      logoUrlLocal: row.logoUrlLocal ?? null,
      rank: row.rank ?? null,
      currentPriceUsd: row.currentPriceUsd ?? null,
      change24HUsdPct: row.change24HUsdPct ?? null,
      categories: row.categories ?? null,
      contractAddress: row.contractAddress ?? null,
    }));

    return { items };
  }

  async upsertFromCryptoData(payload: CryptoData) {
    const {
      slug,
      assetName,
      assetTicker,
    } = payload;

    if (!slug) {
      // защита от мусора: без slug мы не сможем гарантировать identity,
      // и старая логика по ticker'у уже доказала, что перетирает данные.
      throw new Error(`upsertFromCryptoData: missing slug for ${assetTicker}`);
    }

    return this.sequelize.transaction(async (t) => {
      // находим или создаем asset ПО SLUG (не по ticker — у обёрток
      // wrapped/bridged тот же ticker, что у оригинала, и они затирают).
      const [asset, createdAsset] = await this.assetRepo.findOrCreate({
        where: { slug },
        defaults: {
          name: assetName,
          ticker: assetTicker,
          type: AssetType.CRYPTO,
          slug,
        },
        transaction: t,
      });
      if (!createdAsset) {
        // legacy-строки могли быть созданы без slug — обновляем поля и slug
        asset.set({ name: assetName, ticker: assetTicker, slug });
        await asset.save({ transaction: t });
      }

      // crypto-снапшот тоже идентифицируем по slug
      const [assetData, createdAssetData] = await this.cryptoAssetRepo.findOrCreate({
        where: { slug },
        defaults: {
          ...this.mapCryptoDataToAssetData(payload),
          assetId: asset.id,
        },
        transaction: t,
      });

      if (!createdAssetData) {
        // обновляем снапшон + гарантируем связь с asset
        assetData.set({
          ...this.mapCryptoDataToAssetData(payload),
          assetId: asset.id,
        });
        await assetData.save({ transaction: t });
      }

      if (payload.charts) {
        const existingCharts = await this.chartsRepo.findOne({
          where: { assetDataId: assetData.id },
          transaction: t,
        });

        const chartsPayload = this.mapChartsPayload(payload.charts);

        if (!existingCharts) {
          await this.chartsRepo.create(
            {
              assetDataId: assetData.id,
              ...chartsPayload,
              capturedAt: new Date(),
            },
            { transaction: t },
          );
        } else {
          existingCharts.set({
            ...chartsPayload,
            capturedAt: new Date(),
          });
          await existingCharts.save({ transaction: t });
        }
      }

      return { asset, assetData };
    });
  }

  private mapCryptoDataToAssetData(
    data: CryptoData,
  ): Omit<CryptoAssetCreationAttrs, 'assetId'> {
    const normalizeMaxSupply = (val: CryptoData['maxSupply']): string | null => {
      if (val === undefined || val === null) return null;
      return String(val);
    };

    return {
      ticker: data.assetTicker,
      name: data.assetName,

      description: data.assetDescription || undefined,
      categories: data.assetCategories || undefined,
      source: data.source || undefined,
      logoUrl: data.logoUrl || undefined,

      rank: data.currentAssetRank ?? undefined,
      currentPriceUsd: data.currentPrice ?? undefined,
      marketCapUsd: data.marketCap ?? undefined,
      fdvUsd: data.fdv ?? undefined,
      circulatingSupply: data.circulatingSupply ?? undefined,
      totalSupply: data.totalSupply ?? undefined,
      maxSupply: normalizeMaxSupply(data.maxSupply),
      contractAddress: data.contractAddress ?? null,
      volume24HUsd: data.volume24H ?? undefined,

      change1HUsdPct: data.change1HUsdPct ?? undefined,
      change24HUsdPct: data.change24HUsdPct ?? undefined,
      change7DUsdPct: data.change7DUsdPct ?? undefined,
      change14DUsdPct: data.change14DUsdPct ?? undefined,
      change30DUsdPct: data.change30DUsdPct ?? undefined,
      change1YUsdPct: data.change1YUsdPct ?? undefined,

      sparkline7D: data.sparkline7D,
      // Раньше тут был хардкод 'coingecko' — поэтому колонка slug
      // не использовалась. Теперь пишем реальный slug из URL парсера.
      slug: data.slug,
      lastUpdatedAt: new Date(),
    };
  }

  private mapChartsPayload(charts: CryptoData['charts']): Partial<CryptoChartsData> {
    const get = (range: RangeKey, key: keyof ChartPayload): SeriesPoint[] | undefined =>
      charts?.[range]?.[key];

    return {
      h24Stats: get('h24', 'stats'),
      h24Volumes: get('h24', 'total_volumes'),

      d7Stats: get('d7', 'stats'),
      d7Volumes: get('d7', 'total_volumes'),

      d30Stats: get('d30', 'stats'),
      d30Volumes: get('d30', 'total_volumes'),

      d90Stats: get('d90', 'stats'),
      d90Volumes: get('d90', 'total_volumes'),

      d365Stats: get('d365', 'stats'),
      d365Volumes: get('d365', 'total_volumes'),

      maxStats: get('max', 'stats'),
      maxVolumes: get('max', 'total_volumes'),
    };
  }
}
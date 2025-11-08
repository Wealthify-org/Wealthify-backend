import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { CryptoAssetCreationAttrs, CryptoAssetData } from "./models/crypto-asset-data.model";
import { CryptoChartsData } from "./models/crypto-charts-data.model";
import { Asset } from './models/asset.model';
import { Sequelize } from "sequelize";
import { AssetType, ChartPayload, CryptoData, RangeKey, SeriesPoint } from "@app/contracts";


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

  async upsertFromCryptoData(payload: CryptoData) {
    const {
      assetName,
      assetTicker,
    } = payload;

    return this.sequelize.transaction(async (t) => {
      // находим или создаем asset
      const [asset] = await this.assetRepo.findOrCreate({
        where: { ticker: assetTicker },
        defaults: {
          name: assetName,
          ticker: assetTicker,
          type: AssetType.CRYPTO,
        },
        transaction: t,
      });

      // находим или создаем cryptoAssetData по тикеру
      const [assetData, createdAssetData] = await this.cryptoAssetRepo.findOrCreate({
        where: { ticker: assetTicker },
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

      rank: data.currentAssetRank ?? undefined,
      currentPriceUsd: data.currentPrice ?? undefined,
      marketCapUsd: data.marketCap ?? undefined,
      fdvUsd: data.fdv ?? undefined,
      circulatingSupply: data.circulatingSupply ?? undefined,
      totalSupply: data.totalSupply ?? undefined,
      maxSupply: normalizeMaxSupply(data.maxSupply),
      volume24HUsd: data.volume24H ?? undefined,

      change1HUsdPct: data.change1HUsdPct ?? undefined,
      change24HUsdPct: data.change24HUsdPct ?? undefined,
      change7DUsdPct: data.change7DUsdPct ?? undefined,
      change14DUsdPct: data.change14DUsdPct ?? undefined,
      change30DUsdPct: data.change30DUsdPct ?? undefined,
      change1YUsdPct: data.change1YUsdPct ?? undefined,

      sparkline7D: data.sparkline7D,
      slug: 'coingecko',
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
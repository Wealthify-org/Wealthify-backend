import { HttpStatus, Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";

import { Portfolio } from "./portfolios.model";
import { AssetType, CreatePortfolioDto } from "@libs/contracts";
import { PortfolioAssets } from "../portfolio-assets/portfolio-assets.model";
import { Transaction } from "../transactions/transactions.model";
import { rpcError } from "@libs/contracts/common";
import { UserPortfoliosSummaryDto } from "@libs/contracts/portfolios/dto/user-portfolios-summary.dto";
import { ASSETS_CLIENT } from "./portfolio.constants";
import { ASSETS_PATTERNS } from "@libs/contracts/assets/assets.pattern";

// локальный тип того, что вернёт сервис активов
interface AssetWithData {
  id: number;
  ticker: string;
  name?: string;
  type: AssetType;
  assetData?: {
    currentPriceUsd?: number | null;
    change24HUsdPct?: number | null;
    logoUrlLocal?: string | null;
  };
}

@Injectable()
export class PortfoliosService {
  constructor(
    @InjectModel(Portfolio)
    private readonly portfolioRepository: typeof Portfolio,
    @InjectModel(PortfolioAssets)
    private readonly portfolioAssetsRepository: typeof PortfolioAssets,
    @InjectModel(Transaction)
    private readonly transactionRepository: typeof Transaction,
    @Inject(ASSETS_CLIENT)
    private readonly assetsClient: ClientProxy,
  ) {}

  async createPortfolio(dto: CreatePortfolioDto) {
    const exists = await this.portfolioRepository.findOne({
      where: { userId: dto.userId, name: dto.name },
    });
    if (exists) {
      rpcError(
        HttpStatus.CONFLICT,
        "PORTFOLIO_EXISTS",
        `Portfolio "${dto.name}" already exists`,
      );
    }
    return this.portfolioRepository.create(dto);
  }

  private async getAssetsMapByIds(
    assetIds: number[],
  ): Promise<Map<number, AssetWithData>> {
    if (!assetIds.length) return new Map();

    const assets = (await lastValueFrom(
      this.assetsClient.send<AssetWithData[]>(
        ASSETS_PATTERNS.GET_MANY_BY_IDS,
        { ids: assetIds },
      ),
    )) ?? [];

    const map = new Map<number, AssetWithData>();
    for (const asset of assets) {
      map.set(asset.id, asset);
    }
    return map;
  }

  async getAllPortfolios(userId: number) {
    const portfolios = await this.portfolioRepository.findAll({
      where: { userId },
    });

    if (portfolios.length === 0) {
      return {
        portfolios: [],
        valuesUsd: [],
        change24hAbsUsd: [],
        change24hPct: [],
      };
    }

    const portfolioIds = portfolios.map((p) => p.id);

    const rows = await this.portfolioAssetsRepository.findAll({
      where: { portfolioId: portfolioIds },
    });

    const assetIds = Array.from(
      new Set(rows.map((row) => row.assetId).filter((id): id is number => !!id)),
    );

    const assetsMap = await this.getAssetsMapByIds(assetIds);

    const byPortfolio = new Map<number, { totalNow: number; total24hAgo: number }>();

    for (const row of rows) {
      const portfolioId = row.portfolioId;
      const quantity = row.quantity;
      if (!quantity || quantity <= 0) continue;

      const asset = assetsMap.get(row.assetId);
      if (!asset) continue;

      const data = asset.assetData;

      let priceNow: number;
      let change24 = 0;

      if (asset.type === AssetType.FIAT && asset.ticker === "USD") {
        priceNow = 1;
      } else if (data?.currentPriceUsd != null) {
        priceNow = data.currentPriceUsd;
        change24 = data.change24HUsdPct ?? 0;
      } else {
        continue;
      }

      const valueNow = quantity * priceNow;
      let value24hAgo: number;

      if (!change24) {
        value24hAgo = valueNow;
      } else {
        const denom = 1 + change24 / 100;
        value24hAgo = denom <= 0 ? 0 : quantity * (priceNow / denom);
      }

      const bucket =
        byPortfolio.get(portfolioId) ?? { totalNow: 0, total24hAgo: 0 };

      bucket.totalNow += valueNow;
      bucket.total24hAgo += value24hAgo;
      byPortfolio.set(portfolioId, bucket);
    }

    const valuesUsd: number[] = [];
    const change24hAbsUsd: number[] = [];
    const change24hPct: number[] = [];

    for (const portfolio of portfolios) {
      const stats =
        byPortfolio.get(portfolio.id) ?? { totalNow: 0, total24hAgo: 0 };

      const totalNow = stats.totalNow;
      const total24hAgo = stats.total24hAgo;

      const abs = totalNow - total24hAgo;
      const pct = total24hAgo > 0 ? (abs / total24hAgo) * 100 : 0;

      valuesUsd.push(totalNow);
      change24hAbsUsd.push(abs);
      change24hPct.push(pct);
    }

    return {
      portfolios,
      valuesUsd,
      change24hAbsUsd,
      change24hPct,
    };
  }

  async getPortfolioDetailById(id: number, userId: number) {
    const portfolio = await this.portfolioRepository.findByPk(id);

    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${id} not found`,
      );
    }

    if (portfolio.userId !== userId) {
      rpcError(
        HttpStatus.FORBIDDEN,
        "PORTFOLIO_FORBIDDEN",
        `Portfolio ${id} doesn't belong to user ${userId}`,
      );
    }

    const rows = await this.portfolioAssetsRepository.findAll({
      where: { portfolioId: id },
    });

    const assetIds = Array.from(
      new Set(rows.map((r) => r.assetId).filter((x): x is number => !!x)),
    );

    const assetsMap = await this.getAssetsMapByIds(assetIds);

    let totalNow = 0;
    let total24hAgo = 0;
    let totalInvested = 0;

    const assets = rows
      .map((row) => {
        const asset = assetsMap.get(row.assetId);
        if (!asset) return null;

        const data = asset.assetData ?? {};
        const quantity = row.quantity ?? 0;
        const avgBuy = row.averageBuyPrice ?? 0;

        let priceNow: number;
        let change24 = 0;

        if (asset.type === AssetType.FIAT && asset.ticker === "USD") {
          priceNow = 1;
        } else if (data.currentPriceUsd != null) {
          priceNow = data.currentPriceUsd;
          change24 = data.change24HUsdPct ?? 0;
        } else {
          return null;
        }

        const valueNow = quantity * priceNow;
        const invested = quantity * avgBuy;

        let value24hAgo: number;
        if (!change24) {
          value24hAgo = valueNow;
        } else {
          const denom = 1 + change24 / 100;
          value24hAgo = denom <= 0 ? 0 : quantity * (priceNow / denom);
        }

        totalNow += valueNow;
        total24hAgo += value24hAgo;
        totalInvested += invested;

        return {
          assetId: asset.id,
          ticker: asset.ticker,
          name: (asset as any).name ?? asset.ticker,
          type: asset.type,
          quantity,
          averageBuyPrice: avgBuy,
          currentPriceUsd: priceNow,
          change24HUsdPct: change24,
          valueUsd: valueNow,
          investedUsd: invested,
          profitUsd: valueNow - invested,
          profitPct: invested > 0 ? ((valueNow - invested) / invested) * 100 : 0,
          change24hAbsUsd: valueNow - value24hAgo,
          logoUrlLocal: (asset as any).assetData?.logoUrlLocal ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const change24hAbs = totalNow - total24hAgo;
    const change24hPct = total24hAgo > 0 ? (change24hAbs / total24hAgo) * 100 : 0;
    const totalProfit = totalNow - totalInvested;
    const totalProfitPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
      id: portfolio.id,
      name: portfolio.name,
      type: portfolio.type,
      userId: portfolio.userId,
      totalValueUsd: totalNow,
      totalInvestedUsd: totalInvested,
      change24hAbsUsd: change24hAbs,
      change24hPct,
      totalProfitUsd: totalProfit,
      totalProfitPct,
      assets,
    };
  }

  async getPortfolioByName(name: string) {
    const portfolio = await this.portfolioRepository.findOne({
      where: { name },
      include: { all: true, nested: true },
      nest: true,
    });

    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio with name "${name}" doesn't exist`,
      );
    }

    return portfolio;
  }

  async getUserSummary(userId: number): Promise<UserPortfoliosSummaryDto> {
    const rows = await this.portfolioAssetsRepository.findAll({
      include: [
        {
          model: Portfolio,
          where: { userId },
          attributes: ["id"],
        },
      ],
    });

    const assetIds = Array.from(
      new Set(rows.map((row) => row.assetId).filter((id): id is number => !!id)),
    );
    const assetsMap = await this.getAssetsMapByIds(assetIds);

    let totalNow = 0;
    let total24hAgo = 0;

    for (const row of rows) {
      const quantity = row.quantity;
      if (!quantity || quantity <= 0) continue;

      const asset = assetsMap.get(row.assetId);
      if (!asset) continue;

      const data = asset.assetData;

      let priceNow: number;
      let change24 = 0;

      if (asset.type === AssetType.FIAT && asset.ticker === "USD") {
        priceNow = 1;
        change24 = 0;
      } else if (data?.currentPriceUsd != null) {
        priceNow = data.currentPriceUsd;
        change24 = data.change24HUsdPct ?? 0;
      } else {
        continue;
      }

      const valueNow = quantity * priceNow;

      let value24hAgo: number;

      if (!change24) {
        value24hAgo = valueNow;
      } else {
        const denom = 1 + change24 / 100;

        if (denom <= 0) {
          value24hAgo = 0;
        } else {
          const price24hAgo = priceNow / denom;
          value24hAgo = quantity * price24hAgo;
        }
      }

      totalNow += valueNow;
      total24hAgo += value24hAgo;
    }

    if (total24hAgo === 0) {
      return {
        totalValueUsd: totalNow,
        change24hAbsUsd: 0,
        change24hPct: 0,
      };
    }

    const changeAbs = totalNow - total24hAgo;
    const changePct = (changeAbs / total24hAgo) * 100;

    return {
      totalValueUsd: totalNow,
      change24hAbsUsd: changeAbs,
      change24hPct: changePct,
    };
  }

  async deletePortfolio(id: number) {
    const portfolio = await this.portfolioRepository.findByPk(id);

    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${id} not found`,
      );
    }

    await this.transactionRepository.destroy({ where: { portfolioId: id } });
    await this.portfolioAssetsRepository.destroy({ where: { portfolioId: id } });
    await this.portfolioRepository.destroy({ where: { id } });

    return { message: `Portfolio ${id} was successfully deleted` };
  }
}

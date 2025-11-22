import { HttpStatus, Injectable} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { AssetType, CreatePortfolioDto } from  '@libs/contracts';
import { PortfolioAssets } from '@app/assets/portfolio-assets.model';
import { Transaction } from '@app/transactions/transactions.model';
import { rpcError } from '@libs/contracts/common';
import { UserPortfoliosSummaryDto } from '@libs/contracts/portfolios/dto/user-portfolios-summary.dto';
import { Asset } from '@app/assets/assets.model';
import { CryptoAssetData } from '@libs/crypto-data/models';

@Injectable()
export class PortfoliosService {
  constructor(@InjectModel(Portfolio) private portfolioRepository: typeof Portfolio,
              @InjectModel(PortfolioAssets) private portfolioAssetsRepository: typeof PortfolioAssets,
              @InjectModel(Transaction) private transactionRepository: typeof Transaction
            ) {}

  async createPortfolio(dto: CreatePortfolioDto) {
    const exists = await this.portfolioRepository.findOne({ where: { userId: dto.userId, name: dto.name }});
    if (exists) rpcError(HttpStatus.CONFLICT, 'PORTFOLIO_EXISTS', `Portfolio "${dto.name}" already exists`);
    const portfolio = await this.portfolioRepository.create(dto)
    return portfolio
  }

  async getAllPortfolios(id: number) {
    const portfolios = await this.portfolioRepository.findAll({where: {userId: id}, include: {all: true}})
    return portfolios
  }

  async getPortfolioByName(name: string) {
    const portfolio = await this.portfolioRepository.findOne({where: {name}, include: {all: true, nested: true}, nest: true})
    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'PORTFOLIO_NOT_FOUND',
        `Portfolio with name "${name}" doesn't exist`,
      );
    }
    return portfolio
  }

  async getUserSummary(userId: number): Promise<UserPortfoliosSummaryDto> {
    const rows = await this.portfolioAssetsRepository.findAll({
      include: [
        {
          model: Portfolio,
          where: { userId },
          attributes: ["id"],
        },
        {
          model: Asset,
          include: [CryptoAssetData],
        },
      ],
    });

    let totalNow = 0;
    let total24hAgo = 0;

    for (const row of rows) {
      const quantity = row.quantity;
      if (!quantity || quantity <= 0) {
        continue;
      }
      const asset = row.asset;
      if (!asset) {
        continue;
      }

      const data = asset.assetData;

      let priceNow: number | undefined;
      let change24: number = 0;

      if (asset.type === AssetType.FIAT && asset.ticker === "USD") {
        priceNow = 1;
        change24 = 0;
      } else if (data?.currentPriceUsd) {
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
    const portfolio = await this.portfolioRepository.findByPk(id)

    if (!portfolio) {
      rpcError(HttpStatus.NOT_FOUND, 'PORTFOLIO_NOT_FOUND', `Portfolio ${id} not found`);
    }

    await this.transactionRepository.destroy({where: {portfolioId: id}})

    await this.portfolioAssetsRepository.destroy({where: {portfolioId: id}})

    await this.portfolioRepository.destroy({where: {id}})

    return { message: `Portfolio ${id} was successfully deleted`}
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Asset } from './assets.model';
import { CreateAssetDto } from  '@libs/contracts';
// import { PortfolioAssets } from './portfolio-assets.model';

import { AddAssetToPortfolioDto } from  '@libs/contracts';
// import { Portfolio } from '@app/portfolios/portfolios.model';
import { SellAssetDto } from  '@libs/contracts';
import { RemoveAssetFromPortfolioDto } from  '@libs/contracts';
// import { TransactionsService } from '@app/transactions/transactions.service';
import { AssetType } from  '@libs/contracts';
import { TransactionType } from  '@libs/contracts/common/enums/transaction-type.enum';
import { rpcError } from '@libs/contracts/common';
import { CryptoAssetData } from '@libs/crypto-data/models';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset) private assetRepository: typeof Asset,
    ) {}
  
 async createAsset(dto: CreateAssetDto) {
    const { ticker } = dto
    const foundAsset = await this.assetRepository.findOne({where: {ticker}})
    if (foundAsset) {
      rpcError(HttpStatus.CONFLICT, 'ASSET_EXISTS', `Asset ${ticker} already exists`);
    }
    
    const asset = await this.assetRepository.create(dto)
    return asset
  }

  async getAssetByTicker(ticker: string) {
    const asset = await this.assetRepository.findOne({where: {ticker}})

    if (!asset) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `There's no such asset as ${ticker}`);
    }

    return asset
  }

  async getAssetsByIds(ids: number[]) {
    if (!ids.length) return [];

    const assets = await this.assetRepository.findAll({
      where: { id: ids },
      include: [CryptoAssetData],
    });

    return assets;
  }

  async deleteAsset(ticker: string) {
    const asset = await this.assetRepository.findOne({ where: { ticker }})

    if (!asset) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Asset ${ticker} not found`);
    }

    await asset.destroy()

    return { message: `Asset ${ticker} and all it's connections were successfully deleted`}
  }
}

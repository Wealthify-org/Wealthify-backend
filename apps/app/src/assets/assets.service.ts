import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Asset } from './assets.model';
import { CreateAssetDto } from  '@app/contracts';
import { PortfolioAssets } from './portfolio-assets.model';

import { AddAssetToPortfolioDto } from  '@app/contracts';
import { Portfolio } from '@app/portfolios/portfolios.model';
import { SellAssetDto } from  '@app/contracts';
import { RemoveAssetFromPortfolioDto } from  '@app/contracts';
import { TransactionsService } from '@app/transactions/transactions.service';
import { AssetType } from  '@app/contracts';
import { TransactionType } from  '@app/contracts/common/enums/transaction-type.enum';
import { rpcError } from '@app/contracts/common';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset) private assetRepository: typeof Asset,
    @InjectModel(PortfolioAssets) private portfolioAssetRepository: typeof PortfolioAssets,
    @InjectModel(Portfolio) private portfolioRepository: typeof Portfolio,
    private transactionsService: TransactionsService
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

  async addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    const { portfolioId, assetTicker, quantity, purchasePrice } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Asset ${assetTicker} not found`);
    }

    const portfolio = await this.portfolioRepository.findByPk(portfolioId)
    
    if (!portfolio) {
      rpcError(HttpStatus.NOT_FOUND, 'PORTFOLIO_NOT_FOUND', `Portfolio ${portfolioId} not found`);
    }

    if (quantity <= 0) {
      rpcError(HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY', 'Asset quantity should be greater than 0');
    }

    if (purchasePrice <= 0) {
      rpcError(HttpStatus.BAD_REQUEST, 'INVALID_PRICE', 'Asset price should be greater than 0');
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.id}})
    const date = new Date()
    if (portfolioAsset) {
      const newQuantity = portfolioAsset.dataValues.quantity + quantity
      const newAverageBuyPrice = (portfolioAsset.dataValues.quantity * portfolioAsset.dataValues.averageBuyPrice + quantity * purchasePrice) / newQuantity

      portfolioAsset.quantity = newQuantity
      portfolioAsset.averageBuyPrice = newAverageBuyPrice
      portfolioAsset.purchaseDate = date
      await portfolioAsset.save()
    } else {

      const portfolioAssetData = {
        portfolioId,
        assetId: asset.id,
        quantity,
        averageBuyPrice: purchasePrice,
      };

      portfolioAsset = await this.portfolioAssetRepository.create(portfolioAssetData);
      
      const currentDate = date
      portfolioAsset.purchaseDate = currentDate
      await portfolioAsset.save()
    }

    await this.transactionsService.createTransaction({
      portfolioId,
      assetId: asset.dataValues.id,
      quantity,
      pricePerUnit: purchasePrice,
      type: TransactionType.BUY,
      date: date
    })

    return portfolioAsset
  }

  async sellAsset(dto: SellAssetDto) {
    const { portfolioId, assetTicker, quantity, convertToUsd, pricePerUnit } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Asset ${assetTicker} not found`);
    }

    const portfolio = await this.portfolioRepository.findByPk(portfolioId)
    if (!portfolio) {
      rpcError(HttpStatus.NOT_FOUND, 'PORTFOLIO_NOT_FOUND', `Portfolio ${portfolioId} not found`);
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.id}})
    if (!portfolioAsset) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'ASSET_NOT_IN_PORTFOLIO',
        `No such asset ${assetTicker} in portfolio ${portfolioId}`,
      );
    }

    if (quantity <= 0) {
      rpcError(HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY', 'Asset quantity should be greater than 0');
    }

    if (portfolioAsset.quantity < quantity) {
      rpcError(HttpStatus.BAD_REQUEST, 'NOT_ENOUGH_ASSET', 'Not enough asset to sell');
    }

    if (portfolioAsset.dataValues.quantity === quantity) {
      await portfolioAsset.destroy()
    } else {
      portfolioAsset.quantity -= quantity
      await portfolioAsset.save()
    }

    if (convertToUsd) {
      if (!pricePerUnit || pricePerUnit <= 0) {
        rpcError(HttpStatus.BAD_REQUEST, 'INVALID_PRICE', 'Asset price should be greater than zero');
      }

      const usdAmount = quantity * pricePerUnit

      let usdAsset = await this.assetRepository.findOne({ where: { ticker: 'USD'} })
      if (!usdAsset) {
        usdAsset = await this.assetRepository.create({
          name: 'US Dollar',
          ticker: 'USD',
          type: AssetType.FIAT
        })
      }

      await this.addAssetToPortfolio({portfolioId, assetTicker: usdAsset.dataValues.ticker, quantity: usdAmount, purchasePrice: 1})
    }

    await this.transactionsService.createTransaction({
      portfolioId,
      assetId: asset.dataValues.id,
      quantity,
      pricePerUnit: pricePerUnit,
      type: TransactionType.SELL,
      date: new Date()
    })

    return portfolioAsset
  }

  async deleteAsset(ticker: string) {
    const asset = await this.assetRepository.findOne({ where: { ticker }})

    if (!asset) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Asset ${ticker} not found`);
    }
    
    const portfolios = await this.portfolioRepository.findAll()
    for (const portfolio of portfolios) {
      await this.transactionsService.deleteAllLinkedTransactions({
        portfolioId: portfolio.dataValues.id, 
        assetId: asset.dataValues.id
      })
    }

    await this.portfolioAssetRepository.destroy({
      where: {assetId: asset.dataValues.id}
    })

    await asset.destroy()

    return { message: `Asset ${ticker} and all it's connections were successfully deleted`}
  }

  async removeAssetFromPortfolio(dto: RemoveAssetFromPortfolioDto) {
    const { portfolioId, assetTicker, removeAllLinkedTransactions } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Asset ${assetTicker} not found`);
    }

    const portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.dataValues.id}})
    if (!portfolioAsset) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'ASSET_NOT_IN_PORTFOLIO',
        `Asset ${assetTicker} not found in portfolio ${portfolioId}`,
      );
    }

    if (removeAllLinkedTransactions) {
      await this.transactionsService.deleteAllLinkedTransactions({portfolioId, assetId: asset.dataValues.id})
    }

    await portfolioAsset.destroy()

    return {message: `Asset ${assetTicker} was successfully deleted from portfolio ${portfolioId}`}
  }
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Asset } from './assets.model';
import { CreateAssetDto } from './dto/create-asset.dto';
import { PortfolioAssets } from './portfolio-assets.model';

import { AddAssetToPortfolioDto } from './dto/add-asset-to-portfolio.dto';
import { Portfolio } from 'src/portfolios/portfolios.model';
import { SellAssetDto } from './dto/sell-asset.dto';
import { RemoveAssetFromPortfolioDto } from './dto/remove-asset-from-portfolio.dto';
import { TransactionsService } from 'src/transactions/transactions.service';
import { AssetType } from './asset-type.enum';
import { TransactionType } from 'src/transactions/transaction-type.enum';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset) private assetRepository: typeof Asset,
    @InjectModel(PortfolioAssets) private portfolioAssetRepository: typeof PortfolioAssets,
    @InjectModel(Portfolio) private portfolioRepository: typeof Portfolio,
    private transactionsService: TransactionsService
    ) {}
  
  async addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    const { portfolioId, assetTicker, quantity, purchasePrice } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      throw new HttpException(`Asset ${assetTicker} not found`, HttpStatus.NOT_FOUND)
    }

    const portfolio = await this.portfolioRepository.findByPk(portfolioId)
    
    if (!portfolio) {
      throw new HttpException(`Portfolio ${portfolioId} not found`, HttpStatus.NOT_FOUND)
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
  
  async createAsset(dto: CreateAssetDto) {
    const { ticker } = dto
    const foundAsset = await this.assetRepository.findOne({where: {ticker}})
    if (foundAsset) {
      throw new HttpException(`Asset ${ticker} already exists`, HttpStatus.BAD_REQUEST)
    }
    
    const asset = await this.assetRepository.create(dto)
    return asset
  }

  async getAssetByTicker(ticker: string) {
    const asset = await this.assetRepository.findOne({where: {ticker}})

    if (!asset) {
      throw new HttpException(`There\'s no such asset as ${ticker}`, HttpStatus.NOT_FOUND)
    }

    return asset
  }

  async sellAsset(dto: SellAssetDto) {
    const { portfolioId, assetTicker, quantity, convertToUsd, pricePerUnit } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      throw new HttpException(`Asset ${assetTicker} not found`, HttpStatus.NOT_FOUND)
    }

    const portfolio = await this.portfolioRepository.findByPk(portfolioId)
    if (!portfolio) {
      throw new HttpException(`Portfolio ${portfolioId} not found`, HttpStatus.NOT_FOUND)
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.id}})
    if (!portfolioAsset) {
      throw new HttpException(`No such asset ${assetTicker} in portfolio ${portfolioId}`, HttpStatus.NOT_FOUND)
    }

    if (quantity <= 0) {
      throw new HttpException('Asset quantity should be greater than 0', HttpStatus.BAD_REQUEST)
    }

    if (portfolioAsset.dataValues.quantity < quantity) {
      throw new HttpException('Not enough asset to sell', HttpStatus.BAD_REQUEST)
    }

    if (portfolioAsset.dataValues.quantity === quantity) {
      await portfolioAsset.destroy()
    } else {
      portfolioAsset.quantity -= quantity
      await portfolioAsset.save()
    }

    if (convertToUsd) {
      if (pricePerUnit <= 0) {
        throw new HttpException('Asset price should be greater than zero', HttpStatus.BAD_REQUEST)
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
      throw new HttpException(`Asset ${ticker} not found`, HttpStatus.NOT_FOUND)
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
      throw new HttpException(`Asset ${assetTicker} not found`, HttpStatus.NOT_FOUND)
    }

    const portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.dataValues.id}})
    if (!portfolioAsset) {
      throw new HttpException(`Asset ${assetTicker} not found in portfolio ${portfolioId}`, HttpStatus.NOT_FOUND)
    }

    if (removeAllLinkedTransactions) {
      await this.transactionsService.deleteAllLinkedTransactions({portfolioId, assetId: asset.dataValues.id})
    }

    await portfolioAsset.destroy()

    return {message: `Asset ${assetTicker} was successfully deleted from portfolio ${portfolioId}`}
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Asset } from './assets.model';
import { CreateAssetDto } from './dto/create-asset.dto';
import { PortfolioAssets } from './portfolio-assets.model';

import { AddAssetToPortfolioDto } from './dto/add-asset-to-portfolio.dto';

@Injectable()
export class AssetsService {
  constructor(@InjectModel(Asset) private assetRepository: typeof Asset,
              @InjectModel(PortfolioAssets) private portfolioAssetRepository: typeof PortfolioAssets) {}
  
  async addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    const { portfolioId, assetTicker, quantity, purchasePrice } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      throw new Error('Актив не найден')
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.id}})

    if (portfolioAsset) {
      const newQuantity = portfolioAsset.dataValues.quantity + quantity
      const newAverageBuyPrice = (portfolioAsset.dataValues.quantity * portfolioAsset.dataValues.averageBuyPrice + quantity * purchasePrice) / newQuantity

      portfolioAsset.dataValues.quantity = newQuantity
      portfolioAsset.dataValues.averageBuyPrice = newAverageBuyPrice
      portfolioAsset.dataValues.purchaseDate = new Date()
      await portfolioAsset.save()
      
      console.log(portfolioAsset, '\n', portfolioAsset.quantity)

    } else {

      const portfolioAssetData = {
        portfolioId,
        assetId: asset.id,
        quantity,
        averageBuyPrice: purchasePrice,
      };

      portfolioAsset = await this.portfolioAssetRepository.create(portfolioAssetData);
      
      const currentDate = new Date()
      portfolioAsset.dataValues.purchaseDate = currentDate
      await portfolioAsset.save()
    }

    return portfolioAsset
  }
  
  async createAsset(dto: CreateAssetDto) {
    const asset = await this.assetRepository.create(dto)
    return asset
  }

  async getAssetByTicker(ticker: string) {
    const asset = await this.assetRepository.findOne({where: {ticker}})
    return asset
  }
}

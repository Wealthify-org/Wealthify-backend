import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Asset } from './assets.model';
import { CreateAssetDto } from './dto/create-asset.dto';
import { PortfolioAssets } from './portfolio-assets.model';

import { AddAssetToPortfolioDto } from './dto/add-asset-to-portfolio.dto';
import { Portfolio } from 'src/portfolio/portfolios.model';
import { SellAssetDto } from './dto/sell-asset.dto';
import { where } from 'sequelize';
import { RemoveAssetFromPortfolioDto } from './dto/remove-asset-from-portfolio.dto';

@Injectable()
export class AssetsService {
  constructor(@InjectModel(Asset) private assetRepository: typeof Asset,
              @InjectModel(PortfolioAssets) private portfolioAssetRepository: typeof PortfolioAssets,
              @InjectModel(Portfolio) private portfolioRepository: typeof Portfolio) {}
  
  async addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    const { portfolioId, assetTicker, quantity, purchasePrice } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      throw new HttpException('Актив не найден', HttpStatus.NOT_FOUND)
    }

    const portfolio = await this.portfolioRepository.findByPk(portfolioId)
    
    if (!portfolio) {
      throw new HttpException('Портфель не найден', HttpStatus.NOT_FOUND)
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.id}})

    if (portfolioAsset) {
      const newQuantity = portfolioAsset.dataValues.quantity + quantity
      const newAverageBuyPrice = (portfolioAsset.dataValues.quantity * portfolioAsset.dataValues.averageBuyPrice + quantity * purchasePrice) / newQuantity

      portfolioAsset.quantity = newQuantity
      portfolioAsset.averageBuyPrice = newAverageBuyPrice
      portfolioAsset.purchaseDate = new Date()
      await portfolioAsset.save()
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

  async sellAsset(dto: SellAssetDto) {
    const { portfolioId, assetTicker, quantity, convertToUsd, pricePerUnit } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      throw new HttpException('Актив не найден', HttpStatus.NOT_FOUND)
    }

    const portfolio = await this.portfolioRepository.findByPk(portfolioId)
    if (!portfolio) {
      throw new HttpException('Портфель не найден', HttpStatus.NOT_FOUND)
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.id}})
    if (!portfolioAsset) {
      throw new HttpException('Такого актива в портфеле нет', HttpStatus.NOT_FOUND)
    }

    if (quantity <= 0) {
      throw new HttpException('Количество должны быть больше 0', HttpStatus.BAD_REQUEST)
    }

    if (portfolioAsset.dataValues.quantity < quantity) {
      throw new HttpException('Недостаточно актива для продажи', HttpStatus.BAD_REQUEST)
    }

    if (portfolioAsset.dataValues.quantity === quantity) {
      await portfolioAsset.destroy()
    } else {
      portfolioAsset.quantity -= quantity
      await portfolioAsset.save()
    }

    if (convertToUsd) {
      if (pricePerUnit <= 0) {
        throw new HttpException('Укажите корректную цену продаваемого актива', HttpStatus.BAD_REQUEST)
      }

      const usdAmount = quantity * pricePerUnit

      let usdAsset = await this.assetRepository.findOne({ where: { ticker: 'USD'} })
      if (!usdAsset) {
        usdAsset = await this.assetRepository.create({
          name: 'US Dollar',
          ticker: 'USD',
          type: 'Fiat'
        })
      }

      await this.addAssetToPortfolio({portfolioId, assetTicker: usdAsset.dataValues.ticker, quantity: usdAmount, purchasePrice: 1})
    }

    return portfolioAsset
  }

  async deleteAsset(ticker: string) {
    const asset = await this.assetRepository.findOne({ where: { ticker }})

    if (!asset) {
      throw new HttpException('Актив не найден', HttpStatus.NOT_FOUND)
    }

    await this.portfolioAssetRepository.destroy({
      where: {assetId: asset.dataValues.id}
    })

    await asset.destroy()

    return { message: `Актив ${ticker} и все его связи успешно удалены`}
  }

  async removeAssetFromPortfolio(dto: RemoveAssetFromPortfolioDto) {
    const { portfolioId, assetTicker } = dto

    const asset = await this.assetRepository.findOne({where: {ticker: assetTicker}})
    if (!asset) {
      throw new HttpException('Такого актива не существует', HttpStatus.NOT_FOUND)
    }

    const portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId: asset.dataValues.id}})
    if (!portfolioAsset) {
      throw new HttpException('В портфеле нет такого актива', HttpStatus.NOT_FOUND)
    }

    await portfolioAsset.destroy()

    return {message: `Актив ${assetTicker} был успешно удален из портфеля ${portfolioId}`}
  }
}

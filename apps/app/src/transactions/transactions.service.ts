import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from './transactions.model';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PortfolioAssets } from '@app/assets/portfolio-assets.model';
import { CreateTransactionDto } from "@app/contracts";
import { DeleteAllLinkedTransactionsDto } from "@app/contracts";

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction) private transactionRepository: typeof Transaction,
    @InjectModel(PortfolioAssets) private portfolioAssetRepository: typeof PortfolioAssets,
  ) {}
  
  async createTransaction(dto: CreateTransactionDto) {
    return this.transactionRepository.create(dto)
  }

  async getAllTransactions() {
    return this.transactionRepository.findAll({ include: {all: true} })
  }

  async getAllPortfolioTransactions(portfolioId: number) {
    return this.transactionRepository.findAll({where: {portfolioId}, include: {all: true}})
  }

  async deleteTransaction(id: number) {
    const transaction = await this.transactionRepository.findByPk(id)
    if (!transaction) {
      throw new HttpException(`Transaction with id ${id} doesn\'t exist`, HttpStatus.NOT_FOUND)
    }
    let portfolioAsset = await this.getOrCreatePortfolioAsset(transaction)

    if (!portfolioAsset && transaction.dataValues.type === 'BUY') {
      await transaction.destroy()
      return { 
        message: `Transaction ${id} was deleted. Information about asset ${transaction.dataValues.assetId} was not found in portfolio ${transaction.dataValues.portfolioId}` 
      }
    }
    if (!portfolioAsset) {
      throw new HttpException('Failed to create portfolio asset', HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (transaction.dataValues.type === 'BUY') {
      const wasRemoved = await this.handleBuyTransactionDeletion(transaction, portfolioAsset)
      if (wasRemoved)
        return {
          message: `Transaction ${transaction.id} was deleted. Asset ${transaction.assetId} was removed from portfolio ${transaction.portfolioId}`
        }
    }
    if (transaction.dataValues.type === 'SELL') {
      await this.handleSellTransactionDeletion(transaction, portfolioAsset)
    }

    await transaction.destroy()

    return { 
      message: `Transaction ${id} was deleted and information about asset ${transaction.dataValues.assetId} was updated in portfolio ${transaction.dataValues.portfolioId}` 
    }
  }

  private async getOrCreatePortfolioAsset(transaction: Transaction) {
    const {portfolioId, assetId, type} = transaction.dataValues
    let portfolioAsset = await this.portfolioAssetRepository.findOne({where: { portfolioId, assetId }})

    if (!portfolioAsset && type === 'BUY') return null

    if (!portfolioAsset) {
      await this.portfolioAssetRepository.create({
        portfolioId, 
        assetId,
        quantity: 0,
        averageBuyPrice: 0
      })
      portfolioAsset = await this.portfolioAssetRepository.findOne({where: {portfolioId, assetId}})
    }

    return portfolioAsset
  }

  private async handleBuyTransactionDeletion(transaction: Transaction, portfolioAsset: PortfolioAssets) {
    const { quantity, pricePerUnit } = transaction.dataValues
    const newQuantity = portfolioAsset.quantity - quantity

    if (newQuantity <= 0) {
      await portfolioAsset.destroy()
      await transaction.destroy()
      return true
    }

    const totalCost = portfolioAsset.dataValues.averageBuyPrice * portfolioAsset.dataValues.quantity
    const costToRemove = pricePerUnit * quantity
    const newAverageBuyPrice = (totalCost - costToRemove) / newQuantity

    portfolioAsset.quantity = newQuantity
    portfolioAsset.averageBuyPrice = newAverageBuyPrice
    await portfolioAsset.save()
    return false
  }

  private async handleSellTransactionDeletion(transaction: Transaction, portfolioAsset: PortfolioAssets) {
    portfolioAsset.quantity = transaction.dataValues.quantity + portfolioAsset.dataValues.quantity

      const buyTransactions = await this.transactionRepository.findAll({
        where: {
          portfolioId: transaction.dataValues.portfolioId,
          assetId: transaction.dataValues.assetId,
          type: 'BUY'
        }
      })

      let totalQuantity = 0
      let totalCost = 0

      for (const t of buyTransactions) {
        totalQuantity += t.dataValues.quantity
        totalCost += t.dataValues.quantity * t.dataValues.pricePerUnit
      }

      if (totalQuantity > 0) {
        portfolioAsset.averageBuyPrice = totalCost / totalQuantity
      }
      await portfolioAsset.save()
  }

  async deleteAllLinkedTransactions(dto: DeleteAllLinkedTransactionsDto) {
    const {portfolioId, assetId} = dto
    const transactions = await this.transactionRepository.findAll({where: {portfolioId, assetId}})

    for (const transaction of transactions) {
      await transaction.destroy()
    }
  }
}

import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from './transactions.model';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PortfolioAssets } from 'src/assets/portfolio-assets.model';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { DeleteAllLinkedTransactionsDto } from './dto/delete-all-linked-transactions.dto';

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
    const transation = await this.transactionRepository.findByPk(id)
    if (!transation) {
      throw new HttpException(`Transaction with id ${id} doesn\'t exist`, HttpStatus.NOT_FOUND)
    }

    const portfolioAsset = await this.portfolioAssetRepository.findOne({
      where: { portfolioId: transation.dataValues.portfolioId, assetId: transation.dataValues.assetId }
    })
    if (!portfolioAsset) {
      throw new HttpException(
        `There\'s no asset ${transation.dataValues.assetId} in portfolio ${transation.dataValues.portfolioId}`,
         HttpStatus.NOT_FOUND)
    }

    if (transation.type === 'BUY') {
      const newQuantity = portfolioAsset.dataValues.quantity - transation.dataValues.quantity
      if (newQuantity <= 0) {
        throw new HttpException('Asset\'s quantity should be greater than zero', HttpStatus.BAD_REQUEST)
      }

      const totalCost = portfolioAsset.dataValues.averageBuyPrice * portfolioAsset.dataValues.quantity
      const costToRemove = transation.dataValues.pricePerUnit * transation.dataValues.quantity

      if (newQuantity === 0) {
        await portfolioAsset.destroy()
      }
      const newAveragePrice = (totalCost - costToRemove) / newQuantity

      portfolioAsset.quantity = newQuantity
      portfolioAsset.averageBuyPrice = newAveragePrice
    }

    if (transation.dataValues.type === 'SELL') {
      portfolioAsset.quantity += transation.dataValues.quantity

      const buyTransactions = await this.transactionRepository.findAll({
        where: { portfolioId: transation.dataValues.portfolioId, assetId: transation.dataValues.assetId }
      })

      let totalQuantity = transation.dataValues.quantity
      let totalCost = transation.dataValues.pricePerUnit * transation.dataValues.quantity

      for (const t of buyTransactions) {
        totalQuantity += t.dataValues.quantity
        totalCost += t.dataValues.quantity * t.dataValues.pricePerUnit
      }

      portfolioAsset.averageBuyPrice = totalQuantity === 0 
      ? transation.dataValues.pricePerUnit 
      : totalCost / totalQuantity
    }

    await portfolioAsset.save()
    await transation.destroy()

    return { 
      message: `Transaction ${id} was deleted and information about asset 
      ${transation.dataValues.assetId} was updated in portfolio ${transation.dataValues.portfolioId}` 
    }
  }

  async deleteAllLinkedTransactions(dto: DeleteAllLinkedTransactionsDto) {
    const {portfolioId, assetId} = dto
    const transactions = await this.transactionRepository.findAll({where: {portfolioId, assetId}})

    for (const transaction of transactions) {
      await transaction.destroy()
    }
  }
}

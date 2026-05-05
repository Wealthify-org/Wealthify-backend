import { InjectModel } from '@nestjs/sequelize';
import { Portfolio } from '../portfolios/portfolios.model';
import { Transaction } from './transactions.model';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PortfolioAssets } from '../portfolio-assets/portfolio-assets.model';
import { CreateTransactionDto } from "@libs/contracts";
import { DeleteAllLinkedTransactionsDto } from "@libs/contracts";
import { rpcError } from '@libs/contracts/common';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction) private transactionRepository: typeof Transaction,
    @InjectModel(PortfolioAssets) private portfolioAssetRepository: typeof PortfolioAssets,
    @InjectModel(Portfolio) private portfolioRepository: typeof Portfolio,
  ) {}

  /** Проверяет, что портфель принадлежит вызывающему. Иначе rpcError 403. */
  private async assertPortfolioOwnedByUser(
    portfolioId: number,
    userId: number,
  ): Promise<void> {
    const portfolio = await this.portfolioRepository.findByPk(portfolioId, {
      attributes: ['id', 'userId'],
    });
    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'PORTFOLIO_NOT_FOUND',
        `Portfolio ${portfolioId} not found`,
      );
    }
    if (portfolio.userId !== userId) {
      rpcError(
        HttpStatus.FORBIDDEN,
        'PORTFOLIO_FORBIDDEN',
        `Portfolio ${portfolioId} doesn't belong to user ${userId}`,
      );
    }
  }
  
  async createTransaction(
    dto: CreateTransactionDto,
    options?: { transaction?: import("sequelize").Transaction },
  ) {
    return this.transactionRepository.create(dto, options)
  }

  async getAllTransactions() {
    return this.transactionRepository.findAll({ include: {all: true} })
  }

  async getAllPortfolioTransactions(portfolioId: number, userId: number) {
    await this.assertPortfolioOwnedByUser(portfolioId, userId);
    return this.transactionRepository.findAll({where: {portfolioId}, include: {all: true}})
  }

  async deleteTransaction(id: number, userId: number) {
    const transaction = await this.transactionRepository.findByPk(id)
    if (!transaction) {
      rpcError(HttpStatus.NOT_FOUND, 'TRANSACTION_NOT_FOUND', `Transaction with id ${id} doesn't exist`);
    }
    // Ownership-check: транзакция принадлежит портфелю текущего пользователя.
    await this.assertPortfolioOwnedByUser(
      transaction.dataValues.portfolioId,
      userId,
    );
    let portfolioAsset = await this.getOrCreatePortfolioAsset(transaction)

    if (!portfolioAsset && transaction.dataValues.type === 'BUY') {
      await transaction.destroy()
      return { 
        message: `Transaction ${id} was deleted. Information about asset ${transaction.dataValues.assetId} was not found in portfolio ${transaction.dataValues.portfolioId}` 
      }
    }
    if (!portfolioAsset) {
      rpcError(HttpStatus.INTERNAL_SERVER_ERROR, 'PORTFOLIO_ASSET_CREATE_FAILED', 'Failed to create portfolio asset');
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
    const { portfolioId, assetId, type } = transaction.dataValues
    const portfolioAsset = await this.portfolioAssetRepository.findOne({
      where: { portfolioId, assetId },
    })

    if (portfolioAsset) return portfolioAsset
    if (type === 'BUY') return null

    // create() возвращает уже сохранённый instance — лишний findOne не нужен
    return this.portfolioAssetRepository.create({
      portfolioId,
      assetId,
      quantity: 0,
      averageBuyPrice: 0,
    })
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
    const { portfolioId, assetId } = dto
    // Один bulk DELETE вместо findAll + per-row destroy. Был N+1 при
    // удалении актива с большой историей транзакций.
    await this.transactionRepository.destroy({
      where: { portfolioId, assetId },
    })
  }
}

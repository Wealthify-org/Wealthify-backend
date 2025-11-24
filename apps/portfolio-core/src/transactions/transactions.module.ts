import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Transaction } from './transactions.model';
import { Portfolio } from '../portfolios/portfolios.model';
import { PortfolioAssets } from '../portfolio-assets/portfolio-assets.model';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  imports: [
    SequelizeModule.forFeature([Transaction, PortfolioAssets, Portfolio]),
  ],
  exports: [
    TransactionsService
  ]
})
export class TransactionsModule {}

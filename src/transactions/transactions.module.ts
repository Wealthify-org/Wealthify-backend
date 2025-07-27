import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Transaction } from './transactions.model';
import { Portfolio } from 'src/portfolio/portfolios.model';
import { Asset } from 'src/assets/assets.model';
import { PortfolioAssets } from 'src/assets/portfolio-assets.model';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  imports: [
    SequelizeModule.forFeature([Transaction, PortfolioAssets, Asset, Portfolio])
  ],
  exports: [
    TransactionsService
  ]
})
export class TransactionsModule {}

import { Module } from '@nestjs/common';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { Asset } from 'src/assets/assets.model';
import { PortfolioAssets } from 'src/assets/portfolio-assets.model';
import { AssetsModule } from 'src/assets/assets.module';
import { Transaction } from 'src/transactions/transactions.model';
import { TransactionsModule } from 'src/transactions/transactions.module';

@Module({
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  imports: [
    SequelizeModule.forFeature([Portfolio, Asset, PortfolioAssets, Transaction]),
    AssetsModule
  ],
  exports: [
    PortfoliosService
  ]
})
export class PortfoliosModule {}

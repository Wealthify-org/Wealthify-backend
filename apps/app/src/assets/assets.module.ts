import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Portfolio } from "@app/portfolios/portfolios.model"
import { Asset } from './assets.model';
import { PortfolioAssets } from './portfolio-assets.model';
import { TransactionsModule } from '@app/transactions/transactions.module';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService],
  imports: [
    SequelizeModule.forFeature([Asset, Portfolio, PortfolioAssets]),
    TransactionsModule,
  ],
  exports: [
    AssetsService
  ]
})
export class AssetsModule {}

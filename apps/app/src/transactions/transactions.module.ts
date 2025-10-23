import { forwardRef, Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Transaction } from './transactions.model';
import { Portfolio } from '@app/portfolios/portfolios.model';
import { Asset } from '@app/assets/assets.model';
import { PortfolioAssets } from '@app/assets/portfolio-assets.model';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  imports: [
    SequelizeModule.forFeature([Transaction, PortfolioAssets, Asset, Portfolio]),
  ],
  exports: [
    TransactionsService
  ]
})
export class TransactionsModule {}

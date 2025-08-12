import { forwardRef, Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Transaction } from './transactions.model';
import { Portfolio } from 'src/portfolios/portfolios.model';
import { Asset } from 'src/assets/assets.model';
import { PortfolioAssets } from 'src/assets/portfolio-assets.model';
import { AuthModule } from 'src/auth/auth.module';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  imports: [
    SequelizeModule.forFeature([Transaction, PortfolioAssets, Asset, Portfolio]),
    RolesModule,
    AuthModule
  ],
  exports: [
    TransactionsService
  ]
})
export class TransactionsModule {}

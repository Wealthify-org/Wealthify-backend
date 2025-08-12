import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Portfolio } from 'src/portfolios/portfolios.model';
import { Asset } from './assets.model';
import { PortfolioAssets } from './portfolio-assets.model';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { AuthModule } from 'src/auth/auth.module';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService],
  imports: [
    SequelizeModule.forFeature([Asset, Portfolio, PortfolioAssets]),
    TransactionsModule,
    RolesModule,
    AuthModule
  ],
  exports: [
    AssetsService
  ]
})
export class AssetsModule {}

import { Module } from '@nestjs/common';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { Asset } from '@app/assets/assets.model';
import { PortfolioAssets } from '@app/assets/portfolio-assets.model';
import { AssetsModule } from '@app/assets/assets.module';
import { Transaction } from '@app/transactions/transactions.model';
import { AuthModule } from '@app/auth/auth.module';
import { CryptoAssetData } from '@libs/crypto-data/models';

@Module({
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  imports: [
    SequelizeModule.forFeature([Portfolio, Asset, PortfolioAssets, Transaction, CryptoAssetData]),
    AssetsModule,
    AuthModule
  ],
  exports: [
    PortfoliosService
  ]
})
export class PortfoliosModule {}

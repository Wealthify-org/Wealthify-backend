import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { Portfolio } from './portfolios/portfolios.model';
import { Transaction } from './transactions/transactions.model';
import { PortfolioAssets } from './portfolio-assets/portfolio-assets.model';

import { PortfoliosModule } from './portfolios/portfolios.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PortfolioAssetsModule } from './portfolio-assets/portfolio-assets.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV ?? 'development'}.env`,
    }),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [Portfolio, Transaction, PortfolioAssets],
      autoLoadModels: true,
      synchronize: true,
    }),
    PortfoliosModule,
    TransactionsModule,
    PortfolioAssetsModule,
    RecommendationsModule,
  ],
})
export class PortfolioCoreModule {}

import { ConfigModule } from '@nestjs/config';
import { Module } from "@nestjs/common";
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersModule } from './users/users.module';
import { User } from "./users/users.model";
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { Role } from "./roles/roles.model";
import { UserRoles } from "./roles/user-roles.model";
import { AssetsModule } from './assets/assets.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { Asset } from "./assets/assets.model";
import { Portfolio } from "./portfolios/portfolios.model";
import { PortfolioAssets } from "./assets/portfolio-assets.model";
import { TransactionsModule } from './transactions/transactions.module';
import { Transaction } from "./transactions/transactions.model";
import { RefreshToken } from "./auth/refresh-token.model";
import { ResetToken } from "./auth/reset-token-model";
import { CryptoAssetData } from "@libs/crypto-data/models";
import { CryptoChartsData } from "@libs/crypto-data/models";

const fish = (): string => {
  console.log("BITCH", `.${process.env.NODE_ENV}.env`);
  return `.${process.env.NODE_ENV}.env`
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: fish()
    }),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [User, RefreshToken, ResetToken, Role, UserRoles, Asset, Portfolio, PortfolioAssets, Transaction, CryptoAssetData, CryptoChartsData],
      autoLoadModels: true,
      synchronize: true, // включи это временно
      sync: { alter: true }
    }),
    UsersModule,
    AuthModule,
    RolesModule,
    AssetsModule,
    PortfoliosModule,
    TransactionsModule,
  ]
})
export class AppModule {

}
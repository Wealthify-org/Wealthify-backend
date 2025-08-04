import { Module } from "@nestjs/common";
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`
    }),
    SequelizeModule.forRoot({
       dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [User, Role, UserRoles, Asset, Portfolio, PortfolioAssets, Transaction],
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
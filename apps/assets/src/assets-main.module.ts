import { ConfigModule } from '@nestjs/config';
import { Module } from "@nestjs/common";
import { SequelizeModule } from '@nestjs/sequelize';
import { AssetsModule } from './assets/assets.module';
import { Asset } from "./assets/assets.model";
import { CryptoAssetData } from "@libs/crypto-data/models";
import { CryptoChartsData } from "@libs/crypto-data/models";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV}.env`
    }),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [Asset, CryptoAssetData, CryptoChartsData],
      autoLoadModels: true,
      synchronize: true, // включи это временно
      sync: { alter: true }
    }),
    AssetsModule,
  ]
})
export class AssetsMainModule {

}
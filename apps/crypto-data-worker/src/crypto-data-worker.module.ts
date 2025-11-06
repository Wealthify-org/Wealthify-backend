import { Module } from '@nestjs/common';
import { CryptoDataWorkerController } from './crypto-data-worker.controller';
import { CryptoDataScrapperService } from './crypto-data-scrapper.service';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoAssetData } from './models/crypto-asset-data.model';
import { CryptoCandle } from './models/crypto-candle.model';
import { PuppeteerService } from './puppeteer.service';
import { ConfigModule } from '@nestjs/config';
import { CryptoChartsData } from './models/crypto-charts-data.model';
import { Asset } from './models/asset.model';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

@Module({
  controllers: [CryptoDataWorkerController],
  providers: [CryptoDataScrapperService, PuppeteerService, CryptoDataWorkerService],
  imports: [
    ScheduleModule.forRoot(),
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
          models: [CryptoAssetData, CryptoCandle, CryptoChartsData, Asset],
          autoLoadModels: true,
          synchronize: true, // включи это временно
          sync: { alter: true }
    }),
    SequelizeModule.forFeature([CryptoAssetData, CryptoCandle, CryptoChartsData, Asset]),
  ],
})
export class CryptoDataWorkerModule {}

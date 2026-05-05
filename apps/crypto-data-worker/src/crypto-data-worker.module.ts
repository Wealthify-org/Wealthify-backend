import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CryptoDataWorkerController } from './crypto-data-worker.controller';
import { CryptoDataScrapperService } from './crypto-data-scrapper.service';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { CryptoAssetData, CryptoCandle, CryptoChartsData } from "@libs/crypto-data/models";
import { PuppeteerService } from './puppeteer.service';
import { Asset } from "@libs/crypto-data/models";
import { CryptoDataWorkerService } from './crypto-data-worker.service';
import { CryptoDataFetcherService } from './crypto-data-fetcher.service';
import { CryptoLogosModule } from './crypto-logos/crypto-logos.module';
import { RecentSearch } from '@libs/crypto-data/models/recent-search.model';
import { RecentSearchesService } from './recent-searches.service';
import { TranslatorModule } from './translator/translator.module';

@Module({
  controllers: [CryptoDataWorkerController],
  providers: [CryptoDataScrapperService, PuppeteerService, CryptoDataWorkerService, CryptoDataFetcherService, RecentSearchesService],
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        dialect: "postgres",
        host: cfg.get<string>("POSTGRES_HOST", "localhost"),
        port: cfg.get<number>("POSTGRES_PORT", 5432),
        username: cfg.get<string>("POSTGRES_USER", "postgres"),
        password: cfg.get<string>("POSTGRES_PASSWORD", "root"),
        database: cfg.get<string>("POSTGRES_DB", "wealthify"),
        autoLoadModels: true,
        synchronize: true,
        sync: { alter: true },
        models: [/* твои модели */],
      }),
    }),
    SequelizeModule.forFeature([CryptoAssetData, CryptoCandle, CryptoChartsData, Asset, RecentSearch]),
    CryptoLogosModule,
    TranslatorModule,
  ],
})
export class CryptoDataWorkerModule {}

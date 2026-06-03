import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';

import { Asset, StockAssetData, StockChartsData } from '@libs/stock-data/models';

import { StockDataWorkerController } from './stock-data-worker.controller';
import { StockDataWorkerService } from './stock-data-worker.service';
import { StockDataFetcherService } from './stock-data-fetcher.service';
import { MoexIssClient } from './moex/moex-iss.client';
import { WikipediaService } from './description/wikipedia.service';
import { StockLogosService } from './logos/stock-logos.service';

@Module({
  controllers: [StockDataWorkerController],
  providers: [
    StockDataWorkerService,
    StockDataFetcherService,
    MoexIssClient,
    WikipediaService,
    StockLogosService,
  ],
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        dialect: 'postgres',
        host: cfg.get<string>('POSTGRES_HOST', 'localhost'),
        port: cfg.get<number>('POSTGRES_PORT', 5432),
        username: cfg.get<string>('POSTGRES_USER', 'postgres'),
        password: cfg.get<string>('POSTGRES_PASSWORD', 'root'),
        database: cfg.get<string>('POSTGRES_DB', 'wealthify'),
        autoLoadModels: true,
        synchronize: true,
        // alter оставлен как в crypto-воркере: новые таблицы (stock_assets,
        // stock_charts_data) создаются сами; общая `assets` не меняется —
        // колонки совпадают со схемой остальных моделей.
        sync: { alter: true },
        models: [Asset, StockAssetData, StockChartsData],
      }),
    }),
    SequelizeModule.forFeature([Asset, StockAssetData, StockChartsData]),
  ],
})
export class StockDataWorkerModule {}

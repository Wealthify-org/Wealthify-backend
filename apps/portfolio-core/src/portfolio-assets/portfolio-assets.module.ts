import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClientsModule, Transport } from "@nestjs/microservices";

import { PortfolioAssets } from "./portfolio-assets.model";
import { Portfolio } from "../portfolios/portfolios.model";
import { Transaction } from "../transactions/transactions.model";

import { PortfolioAssetsService } from "./portfolio-assets.service";
import { PortfolioAssetsController } from "./portfolio-assets.controller";
import { TransactionsModule } from "../transactions/transactions.module";
import { ASSETS_CLIENT } from "../portfolios/portfolio.constants";

@Module({
  imports: [
    SequelizeModule.forFeature([PortfolioAssets, Portfolio, Transaction]),
    TransactionsModule,
    ClientsModule.register([
      {
        name: ASSETS_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672"],
          queue: process.env.ASSETS_QUEUE ?? "assets_rpc", // очередь микросервиса с активами
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [PortfolioAssetsController],
  providers: [PortfolioAssetsService],
  exports: [PortfolioAssetsService],
})
export class PortfolioAssetsModule {}

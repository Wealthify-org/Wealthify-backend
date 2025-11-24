import { Module } from '@nestjs/common';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { PortfolioAssets } from '../portfolio-assets/portfolio-assets.model';
import { Transaction } from '../transactions/transactions.model';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ASSETS_CLIENT } from './portfolio.constants';

@Module({
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  imports: [
    SequelizeModule.forFeature([Portfolio, PortfolioAssets, Transaction]),
    ClientsModule.register([
      {
        name: ASSETS_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672"],
          // тут очередь микросервиса активов (если app = assets, можно APP_QUEUE)
          queue: process.env.ASSETS_QUEUE ?? "assets_rpc",
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  exports: [
    PortfoliosService
  ]
})
export class PortfoliosModule {}

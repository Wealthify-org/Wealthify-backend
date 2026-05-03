import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";

import { OpenRouterModule } from "@libs/openrouter";

import { RecommendationsController } from "./recommendations.controller";
import { RecommendationsService } from "./recommendations.service";
import { IDENTITY_CLIENT } from "./constants";
import { PortfoliosModule } from "../portfolios/portfolios.module";

@Module({
  imports: [
    PortfoliosModule, // даёт PortfoliosService для деталей портфеля
    OpenRouterModule, // даёт OpenRouterService
    ClientsModule.register([
      {
        name: IDENTITY_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672"],
          queue: process.env.IDENTITY_QUEUE ?? "identity_rpc",
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}

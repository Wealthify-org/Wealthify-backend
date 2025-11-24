import { Module } from "@nestjs/common";
import { ClientProxyFactory } from "@nestjs/microservices";

import { ClientConfigModule } from "../client-config/client-config.module";
import { ClientConfigService } from "../client-config/client-config.service";

import { PortfoliosController } from "./portfolios.controller";
import { PortfoliosService } from "./portfolios.service";
import { PORTFOLIO_CLIENT } from "./constant";
import { GatewayAuthModule } from "@gateway/auth/gateway-auth.module";

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [PortfoliosController],
  providers: [
    PortfoliosService,
    {
      provide: PORTFOLIO_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.portfolioClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class PortfoliosModule {}

import { Module } from "@nestjs/common";
import { ClientProxyFactory } from "@nestjs/microservices";

import { OpenRouterModule } from "@libs/openrouter";

import { ClientConfigModule } from "@gateway/client-config/client-config.module";
import { ClientConfigService } from "@gateway/client-config/client-config.service";
import { GatewayAuthModule } from "@gateway/auth/gateway-auth.module";

import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import {
  IDENTITY_CLIENT,
  INDEXES_CLIENT,
  PORTFOLIO_CLIENT,
} from "./constants";

@Module({
  imports: [GatewayAuthModule, ClientConfigModule, OpenRouterModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: PORTFOLIO_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.portfolioClientOptions),
      inject: [ClientConfigService],
    },
    {
      provide: IDENTITY_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.identityClientOptions),
      inject: [ClientConfigService],
    },
    {
      provide: INDEXES_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.indexesWorkerClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class ChatModule {}

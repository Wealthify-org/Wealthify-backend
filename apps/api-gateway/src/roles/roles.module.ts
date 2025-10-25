import { Module } from "@nestjs/common";
import { ClientProxyFactory } from "@nestjs/microservices";

import { ClientConfigModule } from "../client-config/client-config.module";
import { ClientConfigService } from "../client-config/client-config.service";

import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { APP_CLIENT } from "./constant";
import { GatewayAuthModule } from "@gateway/auth/gateway-auth.module";

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [RolesController],
  providers: [
    RolesService,
    {
      provide: APP_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.appClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class RolesModule {}

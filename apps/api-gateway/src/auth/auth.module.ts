import { Module } from "@nestjs/common";
import { ClientProxyFactory } from "@nestjs/microservices";

import { ClientConfigModule } from "../client-config/client-config.module";
import { ClientConfigService } from "../client-config/client-config.service";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { APP_CLIENT } from "./constant";
import { GatewayAuthModule } from "./gateway-auth.module";

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.appClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class AuthModule {}

import { Module } from "@nestjs/common";
import { ClientProxyFactory } from "@nestjs/microservices";

import { ClientConfigModule } from "@gateway/client-config/client-config.module";
import { ClientConfigService } from "@gateway/client-config/client-config.service";
import { GatewayAuthModule } from "@gateway/auth/gateway-auth.module";

import { RiskProfileController } from "./risk-profile.controller";
import { RiskProfileService } from "./risk-profile.service";
import { IDENTITY_CLIENT } from "./constant";

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [RiskProfileController],
  providers: [
    RiskProfileService,
    {
      provide: IDENTITY_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.identityClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class RiskProfileModule {}

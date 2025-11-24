import { Module } from '@nestjs/common';
import { ClientProxyFactory } from '@nestjs/microservices';

import { ClientConfigModule } from '../client-config/client-config.module';
import { ClientConfigService } from '../client-config/client-config.service';
import { GatewayAuthModule } from '@gateway/auth/gateway-auth.module';

import { PortfolioAssetsController } from './portfolio-assets.controller';
import { PortfolioAssetsService } from './portfolio-assets.service';
import { PORTFOLIO_CLIENT } from './constant';

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [PortfolioAssetsController],
  providers: [
    PortfolioAssetsService,
    {
      provide: PORTFOLIO_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.portfolioClientOptions),
      inject: [ClientConfigService],
    },
  ],
  exports: [PortfolioAssetsService],
})
export class PortfolioAssetsModule {}

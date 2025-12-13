import { Module } from '@nestjs/common';
import { ClientProxyFactory } from '@nestjs/microservices';

import { ClientConfigModule } from '../client-config/client-config.module';
import { ClientConfigService } from '../client-config/client-config.service';

import { StockDataWorkerController } from './stock-data-worker.controller';
import { StockDataWorkerService } from './stock-data-worker.service';
import { STOCKS_WORKER_CLIENT } from './constant';

import { GatewayAuthModule } from '@gateway/auth/gateway-auth.module';

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [StockDataWorkerController],
  providers: [
    StockDataWorkerService,
    {
      provide: STOCKS_WORKER_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.stocksWorkerClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class StockDataWorkerModule {}

import { Module } from '@nestjs/common';
import { ClientProxyFactory } from '@nestjs/microservices';

import { ClientConfigModule } from '../client-config/client-config.module';
import { ClientConfigService } from '../client-config/client-config.service';

import { IndexesDataWorkerController } from './indexes-data-worker.controller';
import { IndexesDataWorkerService } from './indexes-data-worker.service';
import { INDEXES_WORKER_CLIENT } from './constant';

import { GatewayAuthModule } from '@gateway/auth/gateway-auth.module';

@Module({
  imports: [GatewayAuthModule, ClientConfigModule],
  controllers: [IndexesDataWorkerController],
  providers: [
    IndexesDataWorkerService,
    {
      provide: INDEXES_WORKER_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.indexesWorkerClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class IndexesDataWorkerModule {}

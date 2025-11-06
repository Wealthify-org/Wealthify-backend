import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { WORKER_CLIENT } from './constant';
import { ClientConfigModule } from '@gateway/client-config/client-config.module';
import { ClientConfigService } from '@gateway/client-config/client-config.service';
import { CryptoDataWorkerController } from './crypto-data-worker.controller';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

@Module({
  imports: [
    ClientConfigModule,
    ClientsModule.registerAsync([
      {
        name: WORKER_CLIENT,
        imports: [ClientConfigModule],
        inject: [ClientConfigService],
        useFactory: (cfg: ClientConfigService) => cfg.workerClientOptions,
      },
    ]),
  ],
  controllers: [CryptoDataWorkerController],
  providers: [CryptoDataWorkerService],
  exports: [CryptoDataWorkerService],
})
export class CryptoDataWorkerModule {}

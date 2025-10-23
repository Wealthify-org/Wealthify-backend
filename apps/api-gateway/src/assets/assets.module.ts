import { Module } from '@nestjs/common';
import { ClientProxyFactory } from '@nestjs/microservices';

import { ClientConfigModule } from '../client-config/client-config.module';
import { ClientConfigService } from '../client-config/client-config.service';

import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

import { APP_CLIENT } from './constant';

@Module({
  imports: [ClientConfigModule],
  controllers: [AssetsController],
  providers: [
    AssetsService,
    {
      provide: APP_CLIENT,
      useFactory: (cfg: ClientConfigService) => 
        ClientProxyFactory.create(cfg.appClientOptions),
      inject: [ClientConfigService],
    },
  ],
}) 
export class AssetsModule {}
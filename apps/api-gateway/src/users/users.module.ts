import { Module } from '@nestjs/common';
import { ClientProxyFactory } from '@nestjs/microservices';

import { ClientConfigModule } from '../client-config/client-config.module';
import { ClientConfigService } from '../client-config/client-config.service';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { APP_CLIENT } from "./constant";

@Module({
  imports: [ClientConfigModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: APP_CLIENT,
      useFactory: (cfg: ClientConfigService) =>
        ClientProxyFactory.create(cfg.appClientOptions),
      inject: [ClientConfigService],
    },
  ],
})
export class UsersModule {}

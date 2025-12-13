import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from "zod"
import { ClientConfigService } from './client-config.service';

const envSchema = z.object({
  // основной микросервис app
  APP_CLIENT_HOST: z.string().default('127.0.0.1'),
  APP_CLIENT_PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // воркер crypto-data-worker
  WORKER_CLIENT_HOST: z.string().default('127.0.0.1'),
  WORKER_CLIENT_PORT: z.coerce.number().int().min(1).max(65535).default(3002),

  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),

  ASSETS_QUEUE: z.string().default('assets_rpc'),
  WORKER_QUEUE: z.string().default('crypto_data_worker_rpc'),
  IDENTITY_QUEUE: z.string().default('identity_rpc'),
  PORTFOLIO_QUEUE: z.string().default('portfolio_rpc'),

  INDEXES_QUEUE: z.string().default('indexes_data_worker_rpc'),
  STOCKS_QUEUE: z.string().default('stocks_data_worker_rpc'),

});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      validate: (raw) => envSchema.parse(raw)
    }),
  ],
  providers: [ClientConfigService],
  exports: [ClientConfigService],
})
export class ClientConfigModule {}

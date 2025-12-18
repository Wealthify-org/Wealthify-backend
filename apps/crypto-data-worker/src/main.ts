import { NestFactory } from '@nestjs/core';
import { CryptoDataWorkerModule } from './crypto-data-worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function start() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    CryptoDataWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: process.env.WORKER_QUEUE ?? 'crypto_data_worker_rpc',
        queueOptions: {
          durable: true,
        },
      }
    }
  )
  await app.listen();
}
start();

import { NestFactory } from '@nestjs/core';
import { CryptoDataWorkerModule } from './crypto-data-worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function start() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    CryptoDataWorkerModule,
    {
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: 3002,
      }
    }
  )
  await app.listen();
}
start();

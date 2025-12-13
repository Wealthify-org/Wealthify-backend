import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { StockDataWorkerModule } from './stock-data-worker.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    StockDataWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: process.env.STOCKS_QUEUE ?? 'stocks_data_worker_rpc',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
}

bootstrap();

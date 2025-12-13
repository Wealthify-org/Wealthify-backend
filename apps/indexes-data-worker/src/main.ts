import { NestFactory } from '@nestjs/core';
import { IndexesDataWorkerModule } from './indexes-data-worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    IndexesDataWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: process.env.INDEXES_QUEUE ?? 'indexes_data_worker_rpc',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
}
bootstrap();

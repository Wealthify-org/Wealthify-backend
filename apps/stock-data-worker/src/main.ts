import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { StockDataWorkerModule } from './stock-data-worker.module';

const log = new Logger('StockDataWorker.Bootstrap');

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

  // Корректное завершение: даём Sequelize/cron закрыться по SIGINT/SIGTERM.
  app.enableShutdownHooks();

  // Сетевые/MOEX-сбои в фоновых задачах не должны ронять процесс.
  process.on('unhandledRejection', (reason) => {
    log.error(
      `UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack : reason}`,
    );
  });

  await app.listen();
  log.log('Stock-data-worker started');
}

bootstrap();

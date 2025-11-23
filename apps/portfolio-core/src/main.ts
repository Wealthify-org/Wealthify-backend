import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PortfolioCoreModule } from './portfolio-core.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PortfolioCoreModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
        queue: process.env.PORTFOLIO_QUEUE ?? 'portfolio_core_rpc',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
}

void bootstrap();

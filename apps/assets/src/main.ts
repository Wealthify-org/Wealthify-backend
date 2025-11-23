import { NestFactory } from '@nestjs/core'
import { AssetsMainModule } from './assets-main.module'
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function start() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AssetsMainModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: process.env.ASSETS_QUEUE ?? 'assets_rpc',
        queueOptions: {
          durable: true,
        },
      }
    }
  )
  await app.listen()
}

start()
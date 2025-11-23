import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientOptions, Transport } from '@nestjs/microservices';
import { RabbitMqQueueEnv } from 'libs/common/src/rabbitmq/rabbitmq.constants';

@Injectable()
export class ClientConfigService {
  constructor(private readonly config: ConfigService) {}

  private tcpOptions(hostEnv: string, portEnv: string): ClientOptions {
    const host = this.config.get<string>(hostEnv);
    const port = this.config.get<number>(portEnv);

    if (!host) throw new Error(`${hostEnv} is not defined in .env`);
    if (typeof port !== 'number') throw new Error(`${portEnv} is not defined in .env`);

    return {
      transport: Transport.TCP,
      options: { host, port },
    };
  }


  private rmqOptions(queueEnv: string): ClientOptions {
    const url = this.config.get<string>('RABBITMQ_URL');
    const queue = this.config.get<string>(queueEnv);

    if (!url) {
      throw new Error('RABBITMQ_URL is not defined in .env');
    }
    if (!queue) {
      throw new Error(`${queueEnv} is not defined in .env`);
    }

    return {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue,
        queueOptions: {
          durable: true,
        },
      },
    };
  }

  // опции для клиента к основному микросервису assets
  get assetsClientOptions(): ClientOptions {
    return this.rmqOptions(RabbitMqQueueEnv.ASSETS_QUEUE);
  }

  // опции для клиента к воркеру crypto-data-worker
  get workerClientOptions(): ClientOptions {
    return this.rmqOptions(RabbitMqQueueEnv.WORKER_QUEUE);
  }

  // опции для клиента к микросервису identity
  get identityClientOptions(): ClientOptions {
    return this.rmqOptions(RabbitMqQueueEnv.IDENTITY_QUEUE);
  }

  get portfolioClientOptions(): ClientOptions {
  return this.rmqOptions(RabbitMqQueueEnv.PORTFOLIO_QUEUE);
}
}

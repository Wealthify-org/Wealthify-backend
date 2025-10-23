import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientOptions, Transport } from '@nestjs/microservices';

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

  // Опции для клиента к основному микросервису app
  get appClientOptions(): ClientOptions {
    return this.tcpOptions('APP_CLIENT_HOST', 'APP_CLIENT_PORT');
  }

  // Опции для клиента к воркеру crypto-data-worker
  get workerClientOptions(): ClientOptions {
    return this.tcpOptions('WORKER_CLIENT_HOST', 'WORKER_CLIENT_PORT');
  }
}

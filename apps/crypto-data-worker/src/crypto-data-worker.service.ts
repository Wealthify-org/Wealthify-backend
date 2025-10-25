import { Injectable } from '@nestjs/common';

@Injectable()
export class CryptoDataWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}

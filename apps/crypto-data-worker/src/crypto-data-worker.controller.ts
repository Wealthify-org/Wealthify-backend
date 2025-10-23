import { Controller, Get } from '@nestjs/common';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

@Controller()
export class CryptoDataWorkerController {
  constructor(private readonly cryptoDataWorkerService: CryptoDataWorkerService) {}

  @Get()
  getHello(): string {
    return this.cryptoDataWorkerService.getHello();
  }
}

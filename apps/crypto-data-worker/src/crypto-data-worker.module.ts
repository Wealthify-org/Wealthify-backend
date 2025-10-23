import { Module } from '@nestjs/common';
import { CryptoDataWorkerController } from './crypto-data-worker.controller';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

@Module({
  imports: [],
  controllers: [CryptoDataWorkerController],
  providers: [CryptoDataWorkerService],
})
export class CryptoDataWorkerModule {}

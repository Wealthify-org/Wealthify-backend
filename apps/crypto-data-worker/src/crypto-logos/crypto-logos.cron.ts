import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CryptoLogosService } from './crypto-logos.service';

@Injectable()
export class CryptoLogosCron {
  private readonly log = new Logger(CryptoLogosCron.name);

  constructor(private readonly cryptoLogosService: CryptoLogosService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleBackfill(): Promise<void> {
    this.log.debug('Running CryptoLogos backfill cron');
    await this.cryptoLogosService.backfillMissingLogos(50);
  }
}

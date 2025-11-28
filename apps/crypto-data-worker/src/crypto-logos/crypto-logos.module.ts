import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { CryptoAssetData } from '@libs/crypto-data/models'; 
import { LogoStorageService } from './logo-storage.service';
import { CryptoLogosService } from './crypto-logos.service';
import { CryptoLogosCron } from './crypto-logos.cron';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    SequelizeModule.forFeature([CryptoAssetData]),
  ],
  providers: [LogoStorageService, CryptoLogosService, CryptoLogosCron],
  exports: [CryptoLogosService],
})
export class CryptoLogosModule {}

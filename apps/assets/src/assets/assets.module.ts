import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Asset } from './assets.model';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService],
  imports: [
    SequelizeModule.forFeature([Asset]),
  ],
  exports: [
    AssetsService
  ]
})
export class AssetsModule {}

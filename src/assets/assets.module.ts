import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Portfolio } from 'src/portfolio/portfolios.model';
import { Asset } from './assets.model';
import { PortfolioAssets } from './portfolio-assets.model';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService],
  imports: [
    SequelizeModule.forFeature([Asset, Portfolio, PortfolioAssets])
  ],
  exports: [
    AssetsService
  ]
})
export class AssetsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AssetsModule } from '@gateway/assets/assets.module';
import { AuthModule } from '@gateway/auth/auth.module';
import { PortfoliosModule } from '@gateway/portfolios/portfolios.module';
import { RolesModule } from '@gateway/roles/roles.module';
import { TransactionsModule } from '@gateway/transactions/transactions.module';
import { UsersModule } from '@gateway/users/users.module';
import { CryptoDataWorkerModule } from './crypto-data-worker/crypto-data-worker.module';
import { PortfolioAssetsModule } from './portfolio-assets/portfolio-assets.module';
import { ScheduleModule } from '@nestjs/schedule';
import { IndexesDataWorkerModule } from './indexes-data-worker/indexes-data-worker.module';
import { StockDataWorkerModule } from './stock-data-worker/stock-data-worker.module';
import { FavoritesModule } from './favorites/favorites.module';
import { RiskProfileModule } from './risk-profile/risk-profile.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`
    }),
    ScheduleModule.forRoot(),
    AssetsModule,
    AuthModule,
    PortfoliosModule,
    RolesModule,
    TransactionsModule,
    UsersModule,
    CryptoDataWorkerModule,
    PortfolioAssetsModule,
    IndexesDataWorkerModule,
    StockDataWorkerModule,
    FavoritesModule,
    RiskProfileModule,
    ChatModule,
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}

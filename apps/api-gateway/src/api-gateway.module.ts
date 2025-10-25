import { Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AssetsModule } from '@gateway/assets/assets.module';
import { AuthModule } from '@gateway/auth/auth.module';
import { PortfoliosModule } from '@gateway/portfolios/portfolios.module';
import { RolesModule } from '@gateway/roles/roles.module';
import { TransactionsModule } from '@gateway/transactions/transactions.module';
import { UsersModule } from '@gateway/users/users.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`
    }),
    AssetsModule,
    AuthModule,
    PortfoliosModule,
    RolesModule,
    TransactionsModule,
    UsersModule
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}

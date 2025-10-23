import { Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AssetsModule } from '@app/assets/assets.module';
import { AuthModule } from '@app/auth/auth.module';
import { PortfoliosModule } from '@app/portfolios/portfolios.module';
import { RolesModule } from '@app/roles/roles.module';
import { TransactionsModule } from '@app/transactions/transactions.module';

@Module({
  imports: [
    AssetsModule,
    AuthModule,
    PortfoliosModule,
    RolesModule,
    TransactionsModule,
    
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}

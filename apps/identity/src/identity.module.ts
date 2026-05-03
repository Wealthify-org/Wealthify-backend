import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';

import { User } from './users/users.model';
import { Role } from './roles/roles.model';
import { UserRoles } from './roles/user-roles.model';
import { RefreshToken } from './auth/refresh-token.model';
import { ResetToken } from './auth/reset-token-model';
import { FavoriteAsset } from './user-activity/favorite-asset.model';
import { FavoritesModule } from './user-activity/favorites.module';
import { RiskProfile } from './risk-profile/risk-profile.model';
import { RiskProfileModule } from './risk-profile/risk-profile.module';
import { ChatMessage } from './chat-history/chat-message.model';
import { ChatHistoryModule } from './chat-history/chat-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV ?? 'development'}.env`,
    }),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [User, Role, UserRoles, RefreshToken, ResetToken, FavoriteAsset, RiskProfile, ChatMessage],
      autoLoadModels: true,
      synchronize: true,
      sync: { alter: true },
    }),
    UsersModule,
    AuthModule,
    RolesModule,
    FavoritesModule,
    RiskProfileModule,
    ChatHistoryModule,
  ],
})
export class IdentityModule {}

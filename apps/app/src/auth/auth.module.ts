import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { SequelizeModule } from '@nestjs/sequelize';
import { RefreshToken } from './refresh-token.model';
import { ResetToken } from './reset-token-model';

import { UsersModule } from '@app/users/users.module';
import { User } from '@app/users/users.model';

import { MailService } from '@app/common/services/mail.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailService],
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET') || 'SECRET';
        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
    }),
    forwardRef(() => UsersModule),
    SequelizeModule.forFeature([RefreshToken, ResetToken, User])
  ],
  exports: [
    AuthService,
    JwtModule
  ]
})
export class AuthModule {}

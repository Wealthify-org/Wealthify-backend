import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { SequelizeModule } from '@nestjs/sequelize';
import { RefreshToken } from './refresh-token.model';
import { ResetToken } from './reset-token-model';
import { User } from 'src/users/users.model';
import { MailService } from 'src/common/services/mail.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailService],
  imports: [
    JwtModule.register({
      secret: process.env.PRIVATE_KEY || 'SECRET'
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

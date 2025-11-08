import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from './constant';
import { AUTH_PATTERNS } from '@libs/contracts/auth/auth.pattern';

import {
  LoginDto,
  CreateUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@libs/contracts';

import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class AuthService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  login(dto: LoginDto) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.LOGIN, dto);
  }

  registration(dto: CreateUserDto) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.REGISTRATION, dto);
  }

  refreshTokens(refreshToken: string) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.REFRESH, refreshToken);
  }

  logout(refreshToken: string | null) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.LOGOUT, refreshToken);
  }

  changePassword(userId: number, dto: ChangePasswordDto) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.CHANGE_PASSWORD, { userId, dto });
  }

  forgotPassword(dto: ForgotPasswordDto) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.FORGOT_PASSWORD, dto);
  }

  resetPassword(dto: ResetPasswordDto) {
    return sendOrThrow(this.appMs, AUTH_PATTERNS.RESET_PASSWORD, dto);
  }
}

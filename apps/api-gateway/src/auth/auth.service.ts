import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from './auth.module';
import { AUTH_PATTERNS } from '@app/contracts/auth/auth.pattern';

import {
  LoginDto,
  CreateUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@app/contracts';

@Injectable()
export class AuthService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  login(dto: LoginDto) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.LOGIN, 
        dto
      )
    );
  }

  registration(dto: CreateUserDto) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.REGISTRATION, 
        dto
      )
    );
  }

  refreshTokens(refreshToken: string) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.REFRESH, 
        refreshToken
      )
    );
  }

  logout(refreshToken: string | null) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.LOGOUT, 
        refreshToken
      )
    );
  }

  changePassword(userId: number, dto: ChangePasswordDto) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.CHANGE_PASSWORD, 
        { userId, dto }
      ),
    );
  }

  forgotPassword(dto: ForgotPasswordDto) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.FORGOT_PASSWORD, 
        dto
      )
    );
  }

  resetPassword(dto: ResetPasswordDto) {
    return firstValueFrom(
      this.appMs.send(
        AUTH_PATTERNS.RESET_PASSWORD, 
        dto
      )
    );
  }
}

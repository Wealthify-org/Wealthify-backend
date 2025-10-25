import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AUTH_PATTERNS } from '@app/contracts/auth/auth.pattern';

import {
  LoginDto,
  CreateUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@app/contracts';
import { MessagePattern, Payload } from '@nestjs/microservices';



@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  async login(@Payload() userDto: LoginDto) {
    return this.authService.login(userDto);
  }

  @MessagePattern(AUTH_PATTERNS.REGISTRATION)
  async registration(@Payload() userDto: CreateUserDto) {
    return this.authService.registration(userDto);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  async refreshTokens(@Payload() refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  async logout(@Payload() refreshToken: string | null) {
    if (refreshToken) {
      return this.authService.revokeRefreshToken(refreshToken);
    }
    return { ok: true };
  }


  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(@Payload() payload: { userId: number; dto: ChangePasswordDto }) {
    return this.authService.changePassword(payload.userId, payload.dto);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}

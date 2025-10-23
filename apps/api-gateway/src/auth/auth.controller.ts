import { Body, Controller, HttpStatus, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';

import { AuthService } from './auth.service';
import {
  LoginDto,
  CreateUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@app/contracts';

import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } from "./cookie.const";

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Вход в аккаунт' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Успешный вход' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Неверный email или пароль' })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.auth.login(dto);
    setAuthCookies(res, refreshToken);
    return { tokenType: 'Bearer', accessToken, user };
  }

  @ApiOperation({ summary: 'Регистрация нового аккаунта' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Регистрация прошла успешно' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Пользователь с таким email уже существует' })
  @Post('registration')
  async registration(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.auth.registration(dto);
    setAuthCookies(res, refreshToken);
    return { tokenType: 'Bearer', accessToken, user };
  }

  @ApiOperation({ summary: 'Обновление токенов' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Обновление прошло успешно' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Рефреш токен невалиден/отсутствует' })
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const { accessToken, refreshToken: nextRefreshToken, user } = await this.auth.refreshTokens(refreshToken);
    setAuthCookies(res, nextRefreshToken);
    return { tokenType: 'Bearer', accessToken, user };
  }

  @ApiOperation({ summary: 'Выход (инвалидация refresh + очистка cookie)' })
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? null;
    await this.auth.logout(refreshToken);
    clearAuthCookies(res);
    return { message: 'ok' };
  }

  @ApiOperation({ summary: 'Смена пароля' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Смена пароля прошла успешно' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Пользователь не найден' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Пароль введён неверно' })
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    // JwtAuthGuard должен положить userId в req (или req.user.id)
    const userId: number = req.userId ?? req.user?.id;
    return this.auth.changePassword(userId, dto);
  }

  @ApiOperation({ summary: 'Отправить письмо со ссылкой на восстановление пароля' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Письмо отправлено, если пользователь существует' })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Восстановление пароля' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Ссылка невалидна/истекла' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Пользователь не найден' })
  @Put('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}

import { Body, Controller, HttpStatus, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Response, Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE, setAuthCookies } from './cookie.const';


@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({summary: 'Вход в аккаунт'})
  @ApiResponse({status: HttpStatus.OK, description: 'Успешный вход', type: String})
  @ApiResponse({status: HttpStatus.UNAUTHORIZED, description: 'Неверный email или пароль'})
  @Post('/login')
  async login(@Body() userDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(userDto);
    setAuthCookies(res, refreshToken);
    return { tokenType: "Bearer", accessToken, user };
  }

  @ApiOperation({summary: 'Регистрация нового аккаунта'})
  @ApiResponse({status: HttpStatus.CREATED, description: 'Регистрация прошла успешно', type: String})
  @ApiResponse({status: HttpStatus.BAD_REQUEST, description: 'Пользователь с таким email уже существует'})
  @Post('/registration')
  async registration(@Body() userDto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.registration(userDto)
    setAuthCookies(res, refreshToken)
    return { tokenType: "Bearer", accessToken, user };
  }

  @ApiOperation({summary: 'Обновление токенов'})
  @ApiResponse({status: HttpStatus.OK, description: 'Обновление прошло успешно'})
  @ApiResponse({status: HttpStatus.UNAUTHORIZED, description: 'Рефреш токены не совпадают'})
  @ApiResponse({status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Пользователя не удалось найти'})
  @Post('refresh')
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const { accessToken, refreshToken: nextRefreshToken, user } = 
      await this.authService.refreshTokens(refreshToken)
      setAuthCookies(res, nextRefreshToken)
      return { tokenType: "Bearer", accessToken, user };
  }

  @ApiOperation({ summary: 'Выход (инвалидация refresh + очистка cookie)' })
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE]
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken)
    }
    clearAuthCookies(res)
    return { message: 'ok' }
  }


  @ApiOperation({summary: 'Cмена пароля'})
  @ApiResponse({status: HttpStatus.OK, description: 'Смена пароля прошла успешно'})
  @ApiResponse({status: HttpStatus.NOT_FOUND, description: 'Пользователь не найден'})
  @ApiResponse({status: HttpStatus.UNAUTHORIZED, description: 'Пароль введен неверно'})
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  changePassword(@Body() changePasswordDto: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(
      req.userId,
      changePasswordDto
    )
  }

  @ApiOperation({summary: 'Отсылает пользователю письмо (если он существует) с ссылкой на восстановление пароля'})
  @ApiResponse({status: HttpStatus.OK, description: 'Письпо успешно отправлено пользователю (если он существует)'})
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto)
  }

  @ApiOperation({summary: 'Восстановление пароля'})
  @ApiResponse({status: HttpStatus.UNAUTHORIZED, description: 'Ссылка невалидна/истекла'})
  @ApiResponse({status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Пользователь, не найден'})
  @Put('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto)
  }
}

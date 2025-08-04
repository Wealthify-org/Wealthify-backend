import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { dot } from 'node:test/reporters';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({summary: 'Вход в аккаунт'})
  @ApiResponse({status: 200, description: 'Успешный вход', type: String})
  @ApiResponse({status: 401, description: 'Неверный email или пароль'})
  @Post('/login')
  login(@Body() userDto: CreateUserDto) {
    return this.authService.login(userDto)
  }

  @ApiOperation({summary: 'Регистрация нового аккаунта'})
  @ApiResponse({status: 201, description: 'Регистрация прошла успешно', type: String})
  @ApiResponse({status: 400, description: 'Пользователь с таким email уже существует'})
  @Post('/registration')
  registration(@Body() userDto: CreateUserDto) {
    return this.authService.registration(userDto)
  }
}

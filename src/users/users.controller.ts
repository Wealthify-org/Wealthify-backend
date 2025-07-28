import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from './users.model';

@ApiTags('Пользователи')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Создание нового пользователя' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Пользователь успешно создан', type: User })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Пользователь с таким email уже существует' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль USER не найдена' })
  @ApiBody({ type: CreateUserDto })
  create(@Body() userDto: CreateUserDto) {
    return this.usersService.createUser(userDto)
  }

  @Get()
  @ApiOperation({ summary: 'Получение всех пользователей' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Список всех пользователей', type: [User] })
  getAll() {
    return this.usersService.getAllUsers()
  }
}

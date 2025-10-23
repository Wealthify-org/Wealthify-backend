import { Body, Controller, Get, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto, AddRoleDto } from '@app/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { RolesGuard } from '@gateway/common/guards/roles.guard';
import { Roles } from '@gateway/common/decorators/roles-auth.decorator';

@ApiTags('Пользователи')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Создание нового пользователя' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Пользователь успешно создан' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Пользователь с таким email уже существует' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Роль 'USER' не найдена" })
  @ApiBody({ type: CreateUserDto })
  create(@Body() dto: CreateUserDto) {
    return this.users.createUser(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Получение всех пользователей' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Список всех пользователей' })
  getAll() {
    return this.users.getAllUsers();
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Добавить роль пользователю' })
  @ApiBody({ type: AddRoleDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Роль успешно добавлена' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль или пользователь не найдены' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'У пользователя уже есть такая роль' })
  addRole(@Body() dto: AddRoleDto) {
    return this.users.addRoleToUser(dto);
  }
}

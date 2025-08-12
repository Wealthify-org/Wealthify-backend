import { Body, Controller, Get, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from './users.model';
import { AddRoleDto } from './dto/add-role.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles-auth.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';

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
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Получение всех пользователей' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Список всех пользователей', type: [User] })
  getAll() {
    return this.usersService.getAllUsers()
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Добавить роль пользователю' })
  @ApiBody({ type: AddRoleDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Роль успешно добавлена' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль или пользователь не найдены' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'У пользователя уже есть такая роль' })
  addRole(@Body() dto: AddRoleDto) {
    return this.usersService.addRoleToUser(dto)
  }

}

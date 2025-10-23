import { Body, Controller, Delete, Get, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RolesService } from './roles.service';
import { CreateRoleDto } from '@app/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { RolesGuard } from '@gateway/common/guards/roles.guard';
import { Roles } from '@gateway/common/decorators/roles-auth.decorator';

@ApiTags('Роли')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Создание новой роли' })
  @ApiBody({ type: CreateRoleDto, description: 'value и description' })
  @ApiResponse({ status: 201, description: 'Роль успешно создана' })
  @ApiResponse({ status: 400, description: 'Роль с таким значением уже существует' })
  create(@Body() dto: CreateRoleDto) {
    return this.roles.createRole(dto);
  }

  @Get('/:value')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Получить роль по значению (value)' })
  @ApiParam({ name: 'value', example: 'ADMIN', description: 'Значение роли' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Роль найдена' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль не найдена' })
  getByValue(@Param('value') value: string) {
    return this.roles.getRoleByValue(value);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Получить все роли' })
  @ApiResponse({ status: 200, description: 'Массив ролей' })
  getAll() {
    return this.roles.getAllRoles();
  }

  @Delete(':value')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Удалить роль по значению (value)' })
  @ApiParam({ name: 'value', example: 'ADMIN' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Роль удалена' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль не найдена' })
  deleteRole(@Param('value') value: string) {
    return this.roles.deleteRoleByValue(value);
  }
}

import { Body, Controller, Delete, Get, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from './roles.model';
import { Roles } from 'src/common/decorators/roles-auth.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

console.log('ROLES: RolesGuard type:', typeof RolesGuard, typeof JwtAuthGuard);

@ApiTags('Роли')
@Controller('roles')
export class RolesController {
  constructor(private roleService: RolesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Создание новой роли' })
  @ApiBody({ type: CreateRoleDto, description: 'DTO с данными новой роли (value и description)' })
  @ApiResponse({ status: 201, description: 'Роль успешно создана', type: Role })
  @ApiResponse({ status: 400, description: 'Роль с таким значением уже существует' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.createRole(dto)
  }

  @Get('/:value')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Получить роль по значению (value)' })
  @ApiParam({ name: 'value', type: String, example: 'ADMIN', description: 'Значение роли для поиска' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Роль найдена', type: Role })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль с таким значением не найдена' })
  getByValue(@Param('value') value: string) {
    return this.roleService.getRoleByValue(value)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Получить все роли' })
  @ApiResponse({ status: 200, description: 'Массив с ролями', type: [Role] })
  getAll() {
    return this.roleService.getAllRoles()
  }

  @Delete(':value')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Удалить роль со значением (value)' })
  @ApiParam({ name: 'value', type: String, example: 'ADMIN', description: 'Значение роли для поиска' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Роль удалена'})
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Роль с таким значением не найдена' })
  deleteRole(@Param('value') value: string) {
    return this.roleService.deleteRoleByValue(value)
  }

}

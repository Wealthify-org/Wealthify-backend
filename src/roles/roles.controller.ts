import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RolesService } from './roles.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from './roles.model';

@ApiTags('Роли')
@Controller('roles')
export class RolesController {
  constructor(private roleService: RolesService) {}

  @ApiOperation({summary: 'Создание роли'})
  @ApiResponse({status: 201, type: Role})
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.createRole(dto)
  }

  @ApiOperation({summary: 'Получить роль по ее значению'})
  @ApiResponse({status: 200, type: Role})
  @Get('/:value')
  getByValue(@Param('value') value: string) {
    return this.roleService.getRoleByValue(value)
  }

}

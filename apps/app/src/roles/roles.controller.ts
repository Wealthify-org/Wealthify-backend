import { Controller } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from '@app/contracts';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ROLES_PATTERNS } from '@app/contracts/roles/roles.pattern';

@Controller()
export class RolesController {
  constructor(private roleService: RolesService) {}

  @MessagePattern(ROLES_PATTERNS.CREATE)
  create(@Payload() dto: CreateRoleDto) {
    return this.roleService.createRole(dto)
  }

  @MessagePattern(ROLES_PATTERNS.FIND_BY_VALUE)
  getByValue(@Payload() payload: { value: string }) {
    return this.roleService.getRoleByValue(payload.value)
  }

  @MessagePattern(ROLES_PATTERNS.FIND_ALL)
  getAll() {
    return this.roleService.getAllRoles()
  }

  @MessagePattern(ROLES_PATTERNS.DELETE_BY_VALUE)
  deleteRole(@Payload() payload: { value: string }) {
    return this.roleService.deleteRoleByValue(payload.value)
  }

}

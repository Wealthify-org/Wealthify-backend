import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { APP_CLIENT } from "./constant";
import { ROLES_PATTERNS } from '@libs/contracts/roles/roles.pattern';
import { CreateRoleDto } from '@libs/contracts';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class RolesService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createRole(dto: CreateRoleDto) {
    return sendOrThrow(this.appMs, ROLES_PATTERNS.CREATE, dto);
  }

  getRoleByValue(value: string) {
    return sendOrThrow(this.appMs, ROLES_PATTERNS.FIND_BY_VALUE, { value });
  }

  getAllRoles() {
    return sendOrThrow(this.appMs, ROLES_PATTERNS.FIND_ALL, {});
  }

  deleteRoleByValue(value: string) {
    return sendOrThrow(this.appMs, ROLES_PATTERNS.DELETE_BY_VALUE, { value });
  }
}

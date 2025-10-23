import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from "./constant";
import { ROLES_PATTERNS } from '@app/contracts/roles/roles.pattern';
import { CreateRoleDto } from '@app/contracts';

@Injectable()
export class RolesService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createRole(dto: CreateRoleDto) {
    return firstValueFrom(
      this.appMs.send(
        ROLES_PATTERNS.CREATE, 
        dto
      )
    );
  }

  getRoleByValue(value: string) {
    return firstValueFrom(
      this.appMs.send(
        ROLES_PATTERNS.FIND_BY_VALUE, 
        { value }
      ),
    );
  }

  getAllRoles() {
    return firstValueFrom(
      this.appMs.send(
        ROLES_PATTERNS.FIND_ALL, 
        {}
      )
    );
  }

  deleteRoleByValue(value: string) {
    return firstValueFrom(
      this.appMs.send(
        ROLES_PATTERNS.DELETE_BY_VALUE, 
        { value }
      ),
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from "./constant";
import { USERS_PATTERNS } from '@libs/contracts/users/users.pattern';
import { CreateUserDto, AddRoleDto } from '@libs/contracts';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class UsersService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createUser(dto: CreateUserDto) {
    return sendOrThrow(this.appMs, USERS_PATTERNS.CREATE, dto);
  }

  getAllUsers() {
    return sendOrThrow(this.appMs, USERS_PATTERNS.FIND_ALL, {});
  }

  addRoleToUser(dto: AddRoleDto) {
    return sendOrThrow(this.appMs, USERS_PATTERNS.ADD_ROLE, dto);
  }
}

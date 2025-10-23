import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from "./constant";
import { USERS_PATTERNS } from '@app/contracts/users/users.pattern';
import { CreateUserDto, AddRoleDto } from '@app/contracts';

@Injectable()
export class UsersService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createUser(dto: CreateUserDto) {
    return firstValueFrom(
      this.appMs.send(
        USERS_PATTERNS.CREATE, 
        dto
      )
    );
  }

  getAllUsers() {
    return firstValueFrom(
      this.appMs.send(
        USERS_PATTERNS.FIND_ALL, 
        {}
      )
    );
  }

  addRoleToUser(dto: AddRoleDto) {
    return firstValueFrom(
      this.appMs.send(
        USERS_PATTERNS.ADD_ROLE, 
        dto
      )
    );
  }
}

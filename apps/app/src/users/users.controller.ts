import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, AddRoleDto } from "@app/contracts"
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USERS_PATTERNS } from '@app/contracts/users/users.pattern';


@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(USERS_PATTERNS.CREATE)
  create(@Payload() userDto: CreateUserDto) {
    return this.usersService.createUser(userDto)
  }

  getAll() {
    return this.usersService.getAllUsers()
  }

  addRole(@Payload() dto: AddRoleDto) {
    return this.usersService.addRoleToUser(dto)
  }

}

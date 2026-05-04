import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, AddRoleDto } from "@libs/contracts"
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USERS_PATTERNS } from '@libs/contracts/users/users.pattern';


@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(USERS_PATTERNS.CREATE)
  create(@Payload() userDto: CreateUserDto) {
    return this.usersService.createUser(userDto)
  }

  // Обработчики были без @MessagePattern — RMQ-очередь висит, gateway
  // получает UPSTREAM_TIMEOUT после 5с. Привязываем их к паттернам.
  @MessagePattern(USERS_PATTERNS.FIND_ALL)
  getAll() {
    return this.usersService.getAllUsers()
  }

  @MessagePattern(USERS_PATTERNS.ADD_ROLE)
  addRole(@Payload() dto: AddRoleDto) {
    return this.usersService.addRoleToUser(dto)
  }

}

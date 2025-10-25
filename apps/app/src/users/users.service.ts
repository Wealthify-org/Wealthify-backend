import { HttpStatus, Injectable } from '@nestjs/common';
import { User } from './users.model';
import { InjectModel } from '@nestjs/sequelize';
import { CreateUserDto, AddRoleDto } from "@app/contracts";
import { RolesService } from '@app/roles/roles.service';
import { rpcError } from '@app/contracts/common';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private userRepository: typeof User, 
              private roleService: RolesService) {}

  async createUser(dto: CreateUserDto) {
    const { email } = dto
    const existingUser = await this.userRepository.findOne({
      where: {email},
      include: {all: true, nested: true}, 
      nest: true, 
      raw: true
    })

    if (existingUser) {
      rpcError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'User with such email already exists');
    }

    const user = await this.userRepository.create(dto)
    const role = await this.roleService.getRoleByValue('USER')
    
    if (!role) {
      rpcError(HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND', "Role \'USER\' not found");
    }

    await user.$set('roles', [role.id])
    user.roles = [role]
    await user.$set('portfolios', [])
    
    return user
  }

  async getAllUsers() {
    const users = await this.userRepository.findAll({include: {all: true}})
    return users
  }

  async getUserByEmail(email: string) {
    const user = await this.userRepository.findOne({where: {email}, include: {all: true, nested: true}})
    return user
  }

  async getUserByUsername(username: string) {
    const user = this.userRepository.findOne({where: {username}, include: {all: true, nested: true}});
    return user;
  }

  async getUserById(userId: number) {
    const user = this.userRepository.findByPk(userId, {include: {all: true, nested: true}})
    return user
  }

  async addRoleToUser(dto: AddRoleDto) {
    const { userId, value } = dto
    const user = await this.userRepository.findByPk(
      userId, {include: {all: true, nested: true}}
    )

    if (!user) {
      rpcError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', `User with id ${userId} doesn't exist`);
    }

    const role = await this.roleService.getRoleByValue(value)
    if (!role) {
      rpcError(HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND', `Role '${value}' not found`);
    }

    console.log(user.dataValues)

    const hasRole = user.dataValues.roles.some(role => role.value === value)
    if (hasRole) {
      rpcError(HttpStatus.CONFLICT, 'ROLE_ALREADY_ASSIGNED', `User already has role ${value}`);
    }

    await user.$add('roles', role.id)


    return { message: `Role ${value} was successfully added to user ${userId}` }
  }
}

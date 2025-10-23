import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from './users.model';
import { InjectModel } from '@nestjs/sequelize';
import { CreateUserDto, AddRoleDto } from "@app/contracts";
import { RolesService } from '@app/roles/roles.service';

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
      throw new HttpException('User with such email already exists', HttpStatus.BAD_REQUEST)
    }

    const user = await this.userRepository.create(dto)
    const role = await this.roleService.getRoleByValue('USER')
    
    if (!role) {
      throw new HttpException('Role \'USER\' not found', HttpStatus.NOT_FOUND);
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
    const user = this.userRepository.findOne({where: {email}, include: {all: true, nested: true}})
    return user
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
      throw new HttpException(`User with id: ${userId} doesn't exist`, HttpStatus.NOT_FOUND)
    }

    const role = await this.roleService.getRoleByValue(value)
    if (!role) {
      throw new HttpException('Role \'USER\' not found', HttpStatus.NOT_FOUND);
    }

    console.log(user.dataValues)

    const hasRole = user.dataValues.roles.some(role => role.value === value)
    if (hasRole) {
      throw new HttpException(`User has already got role ${value}`, HttpStatus.BAD_REQUEST)
    }

    await user.$add('roles', role.id)


    return { message: `Role ${value} was successfully added to user ${userId}` }
  }
}

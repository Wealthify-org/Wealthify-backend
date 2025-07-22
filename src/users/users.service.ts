import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from './users.model';
import { InjectModel } from '@nestjs/sequelize';
import { CreateUserDto } from './dto/create-user.dto';
import { RolesService } from 'src/roles/roles.service';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private userRepository: typeof User, 
              private roleService: RolesService) {}

  async createUser(dto: CreateUserDto) {
    const existingUser = await this.getUserByEmail(dto.email)

    if (existingUser) {
      throw new HttpException('User with such email already exists', HttpStatus.BAD_REQUEST)
    }

    const user = await this.userRepository.create(dto)
    const role = await this.roleService.getRoleByValue('USER')
    
    if (!role) {
      throw new Error("Role 'USER' not found");
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
    const user = this.userRepository.findOne({where: {email}, include: {all: true, nested: true}, nest: true, raw: true})
    return user
  }
}

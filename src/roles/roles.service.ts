import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from './roles.model';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role) private roleRepository: typeof Role) {}

  async createRole(dto: CreateRoleDto) {
    const { value } = dto
    const foundRole = await this.roleRepository.findOne({ where: { value } })
    if (foundRole) {
      throw new HttpException(`Role with value ${value} already exists`, HttpStatus.BAD_REQUEST)
    }

    const role = await this.roleRepository.create(dto)
    return role
  }

  async getRoleByValue(value: string) {
    const role = await this.roleRepository.findOne({ where: { value } })
    if (!role) {
      throw new HttpException(`Role with value ${value} doesn\'t exist`, HttpStatus.NOT_FOUND)
    }
    
    return role
  }

  async getAllRoles() {
    const roles = await this.roleRepository.findAll()
    
    return roles
  }

  async deleteRoleByValue(value: string) {
    const role = await this.roleRepository.findOne({ where: { value } })
    if (!role) {
      throw new HttpException(`Role with value ${value} doesn\'t exist`, HttpStatus.NOT_FOUND)
    }

    await role.destroy()

    return { message: `Role with value ${value} was successfully deleted` }
  }

}

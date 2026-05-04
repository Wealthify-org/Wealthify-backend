import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateRoleDto } from '@libs/contracts';
import { Role } from './roles.model';
import { InjectModel } from '@nestjs/sequelize';
import { rpcError } from '@libs/contracts/common';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role) private roleRepository: typeof Role) {}

  async createRole(dto: CreateRoleDto) {
    const { value } = dto;
    const foundRole = await this.roleRepository.findOne({ where: { value } });
    if (foundRole) {
      // Раньше был throw new HttpException — но это RPC-микросервис, там
      // нужен RpcException через rpcError(), иначе caller получает
      // BAD_GATEWAY вместо нашего {status, code, message}.
      rpcError(
        HttpStatus.CONFLICT,
        'ROLE_EXISTS',
        `Role with value ${value} already exists`,
      );
    }

    const role = await this.roleRepository.create(dto);
    return role;
  }

  async getRoleByValue(value: string) {
    const role = await this.roleRepository.findOne({ where: { value } });
    if (!role) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'ROLE_NOT_FOUND',
        `Role with value ${value} doesn't exist`,
      );
    }

    return role;
  }

  async getAllRoles() {
    return this.roleRepository.findAll();
  }

  async deleteRoleByValue(value: string) {
    const role = await this.roleRepository.findOne({ where: { value } });
    if (!role) {
      rpcError(
        HttpStatus.NOT_FOUND,
        'ROLE_NOT_FOUND',
        `Role with value ${value} doesn't exist`,
      );
    }

    await role.destroy();

    return { message: `Role with value ${value} was successfully deleted` };
  }
}

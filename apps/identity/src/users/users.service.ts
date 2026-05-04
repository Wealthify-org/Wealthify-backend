import { HttpStatus, Injectable } from '@nestjs/common';
import { User } from './users.model';
import { InjectModel } from '@nestjs/sequelize';
import { CreateUserDto, AddRoleDto } from "@libs/contracts";
import { RolesService } from '../roles/roles.service';
import { Role } from '../roles/roles.model';
import { rpcError } from '@libs/contracts/common';

/**
 * Лёгкий include под "обычный" fetch юзера: подтягиваем только роли через
 * many-to-many. Раньше использовался `include: { all: true, nested: true }`,
 * который пробрасывал все ассоциации (RefreshToken, ResetToken, ChatMessage,
 * UserRoles join-table) — лишний JOIN на каждом запросе авторизации.
 */
const USER_WITH_ROLES_INCLUDE = [
  { model: Role, through: { attributes: [] } },
];

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private userRepository: typeof User,
    private roleService: RolesService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const { email } = dto

    // Существование проверяем минимально: только id, без include + без raw.
    const existingUser = await this.userRepository.findOne({
      where: { email },
      attributes: ['id'],
    })

    if (existingUser) {
      rpcError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'User with such email already exists');
    }

    const user = await this.userRepository.create(dto)
    const role = await this.roleService.getRoleByValue('USER')

    if (!role) {
      rpcError(HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND', "Role 'USER' not found");
    }

    await user.$set('roles', [role.id])
    user.roles = [role]

    return user
  }

  async getAllUsers() {
    return this.userRepository.findAll({ include: USER_WITH_ROLES_INCLUDE })
  }

  async getUserByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
      include: USER_WITH_ROLES_INCLUDE,
    })
  }

  async getUserByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  async getUserById(userId: number) {
    return this.userRepository.findByPk(userId, {
      include: USER_WITH_ROLES_INCLUDE,
    })
  }

  async addRoleToUser(dto: AddRoleDto) {
    const { userId, value } = dto

    // user + role параллельно — независимые запросы
    const [user, role] = await Promise.all([
      this.userRepository.findByPk(userId, { include: USER_WITH_ROLES_INCLUDE }),
      this.roleService.getRoleByValue(value),
    ])

    if (!user) {
      rpcError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', `User with id ${userId} doesn't exist`);
    }
    if (!role) {
      rpcError(HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND', `Role '${value}' not found`);
    }

    const hasRole = (user.dataValues.roles ?? []).some((r) => r.value === value)
    if (hasRole) {
      rpcError(HttpStatus.CONFLICT, 'ROLE_ALREADY_ASSIGNED', `User already has role ${value}`);
    }

    await user.$add('roles', role.id)

    return { message: `Role ${value} was successfully added to user ${userId}` }
  }
}

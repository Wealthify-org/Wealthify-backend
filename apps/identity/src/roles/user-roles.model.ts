import { Table, Model, Column, DataType, ForeignKey, Index } from "sequelize-typescript";
import { Role } from "./roles.model";
import { User } from "../users/users.model";
import { ApiProperty } from "@nestjs/swagger";

@Table({
  tableName: 'user_roles',
  createdAt: false,
  updatedAt: false,
  // composite unique — один пользователь не получает одну и ту же роль дважды.
  // Также делает быстрый join `User → Roles` по userId.
  indexes: [
    {
      name: 'user_roles_user_role_unique',
      unique: true,
      fields: ['userId', 'roleId'],
    },
  ],
})
export class UserRoles extends Model<UserRoles> {
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор связи пользователя и роли' })
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({ example: 2, description: 'ID роли (ссылается на таблицу ролей)' })
  @ForeignKey(() => Role)
  @Index('user_roles_role_id_idx')
  @Column({type: DataType.INTEGER})
  roleId: number

  @ApiProperty({ example: 5, description: 'ID пользователя (ссылается на таблицу пользователей)' })
  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER})
  userId: number
}
import { Table, Model, Column, DataType, ForeignKey } from "sequelize-typescript";
import { Role } from "./roles.model";
import { User } from "src/users/users.model";
import { ApiProperty } from "@nestjs/swagger";

@Table({tableName: 'user_roles', createdAt: false, updatedAt: false})
export class UserRoles extends Model<UserRoles> {
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор связи пользователя и роли' })
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({ example: 2, description: 'ID роли (ссылается на таблицу ролей)' })
  @ForeignKey(() => Role)
  @Column({type: DataType.INTEGER})
  roleId: number

  @ApiProperty({ example: 5, description: 'ID пользователя (ссылается на таблицу пользователей)' })
  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER})
  userId: number
}
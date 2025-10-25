import { ApiProperty } from "@nestjs/swagger"
import { BelongsToMany, Column, DataType, Model, Table } from "sequelize-typescript"
import { User } from "@app/users/users.model"
import { UserRoles } from "./user-roles.model"

interface RoleCreationAttrs {
  value: string
  description: string
}

@Table({tableName: 'roles'})
export class Role extends Model<Role, RoleCreationAttrs> {
  
  @ApiProperty({example: '1', description: 'Уникальный идентификатор роли пользователя'})
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({example: 'ADMIN', description: 'Название роли пользователя'})
  @Column({type: DataType.STRING, unique: true, allowNull: false})
  declare value: string

  @ApiProperty({example: 'Администратор', description: 'Описание роли пользователя'})
  @Column({type: DataType.STRING, allowNull: false})
  declare description: string

  @ApiProperty({ type: () => [User], description: 'Пользователи, которым назначена эта роль' })
  @BelongsToMany(() => User, () => UserRoles)
  declare users: User[]
}
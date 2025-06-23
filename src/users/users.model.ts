import { ApiProperty } from "@nestjs/swagger";
import { Column, DataType, Table, Model, BelongsToMany } from "sequelize-typescript";
import { Col } from "sequelize/types/utils";
import { Role } from "src/roles/roles.model";
import { UserRoles } from "src/roles/user-roles.model";

interface UserCreationAttrs {
  username: string
  email: string
  password: string
}

@Table({tableName: 'users'})
export class User extends Model<User, UserCreationAttrs> {
  @ApiProperty({example: '1', description: 'Уникальный идентификатор'})
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({example: 'outea7t', description: 'Никнейм пользователя'})
  @Column({type: DataType.STRING, unique: true, allowNull: false})
  username: string

  @ApiProperty({example: 'user@mail.ru', description: 'Почта пользователя'})
  @Column({type: DataType.STRING, unique: true, allowNull: false})
  email: string

  @ApiProperty({example: 'asdfa123', description: 'Пароль пользователя'})
  @Column({type: DataType.STRING, allowNull: false})
  password: string

  @BelongsToMany(() => Role, () => UserRoles)
  roles: Role[]
}
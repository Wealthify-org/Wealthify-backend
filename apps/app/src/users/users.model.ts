import { ApiProperty } from "@nestjs/swagger";
import { Column, DataType, Table, Model, BelongsToMany, HasMany } from "sequelize-typescript";
import { Portfolio } from "@app/portfolios/portfolios.model";
import { Role } from "@app/roles/roles.model";
import { UserRoles } from "@app/roles/user-roles.model";

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
  declare username: string

  @ApiProperty({example: 'user@mail.ru', description: 'Почта пользователя'})
  @Column({type: DataType.STRING, unique: true, allowNull: false})
  declare email: string

  @ApiProperty({example: 'asdfa123', description: 'Пароль пользователя'})
  @Column({type: DataType.STRING, allowNull: false})
  declare password: string

  @ApiProperty({ type: () => [Role], description: 'Список ролей, назначенных пользователю' })
  @BelongsToMany(() => Role, () => UserRoles)
  declare roles: Role[]

  @ApiProperty({ type: () => [Portfolio], description: 'Список инвестиционных портфелей пользователя' })
  @HasMany(() => Portfolio)
  declare portfolios: Portfolio[]
}
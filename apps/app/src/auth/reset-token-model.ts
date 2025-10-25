import { ApiProperty } from "@nestjs/swagger";
import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { User } from "@app/users/users.model";

interface ResetTokenCreationAttrs {
  token: string,
  userId: number,
  expiryDate: Date
}

@Table({tableName: 'reset-token'})
export class ResetToken extends Model<ResetToken, ResetTokenCreationAttrs> {
  @ApiProperty({example: 1, description: 'Айди токена'})
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({example: '-', description: 'Хешированное значение токена'})
  @Column({type: DataType.STRING, allowNull: false})
  declare token: string

  @ApiProperty({example: 5, description: 'Айди пользователя, которому принадлежит токен'})
  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER, allowNull: false, unique: true})
  declare userId: number

  @ApiProperty({example: '2025-07-20T14:48:00.000Z', description: 'Дата истечения работы токена'})
  @Column({type: DataType.DATE, allowNull: false})
  declare expiryDate: Date
}
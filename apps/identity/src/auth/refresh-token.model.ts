import { ApiProperty } from "@nestjs/swagger";
import { Column, DataType, ForeignKey, Model, Table, Index } from "sequelize-typescript";
import { User } from "../users/users.model";

interface RefreshTokenCreationAttrs {
  token: string,
  userId: number,
  expiryDate: Date
}

@Table({tableName: 'refresh-token'})
export class RefreshToken extends Model<RefreshToken, RefreshTokenCreationAttrs> {
  @ApiProperty({example: 1, description: 'Айди токена'})
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({example: '-', description: 'SHA256-хеш значение токена (индексируется для O(1) lookup)'})
  @Index('refresh_token_token_idx')
  @Column({type: DataType.STRING, allowNull: false})
  declare token: string


  @ApiProperty({example: 5, description: 'Айди пользователя, которому принадлежит токен'})
  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER, allowNull: false, unique: true})
  declare userId: number

  @ApiProperty({example: '2025-07-20T14:48:00.000Z', description: 'Дата истечения срока жизни токена'})
  @Index('refresh_token_expiry_date_idx')
  @Column({type: DataType.DATE, allowNull: false})
  declare expiryDate: Date
}
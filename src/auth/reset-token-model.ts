import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { User } from "src/users/users.model";

interface ResetTokenCreationAttrs {
  token: string,
  userId: number,
  expiryDate: Date
}

@Table({tableName: 'reset-token'})
export class ResetToken extends Model<ResetToken, ResetTokenCreationAttrs> {
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @Column({type: DataType.STRING, allowNull: false})
  declare token: string

  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER, allowNull: false, unique: true})
  declare userId: number

  @Column({type: DataType.DATE, allowNull: false})
  declare expiryDate: Date
}
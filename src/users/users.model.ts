import { Column, DataType, Table, Model } from "sequelize-typescript";
import { Col } from "sequelize/types/utils";

interface UserCreationAttrs {
  username: string
  email: string
  password: string
}

@Table({tableName: 'users'})
export class User extends Model<User, UserCreationAttrs> {
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @Column({type: DataType.STRING, unique: true, allowNull: false})
  username: string

  @Column({type: DataType.STRING, unique: true, allowNull: false})
  email: string

  @Column({type: DataType.STRING, allowNull: false})
  password: string

}
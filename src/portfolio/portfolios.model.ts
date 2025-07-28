import { Column, DataType, Table, Model, BelongsToMany, ForeignKey, HasMany } from "sequelize-typescript";
import { Asset } from "src/assets/assets.model";
import { PortfolioAssets } from "src/assets/portfolio-assets.model";
import { Transaction } from "src/transactions/transactions.model";
import { User } from "src/users/users.model";
import { PortfolioType } from "./portfolio-type.enum";

interface PortfolioCreationAttrs {
  name: string
  type: PortfolioType
  userId: number 
}

@Table({tableName: 'portfolios'}) 
export class Portfolio extends Model<Portfolio, PortfolioCreationAttrs> {
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @Column({type: DataType.STRING, unique: false, allowNull: false})
  declare name: string 
  
  @Column({type: DataType.ENUM(...Object.values(PortfolioType)), allowNull: false})
  declare type: PortfolioType

  @BelongsToMany(() => Asset, () => PortfolioAssets)
  declare assets: Asset[]

  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER, allowNull: false})
  declare userId: number

  @HasMany(() => Transaction)
  declare transactions: Transaction[]
}
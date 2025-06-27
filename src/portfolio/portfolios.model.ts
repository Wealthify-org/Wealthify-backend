import { Column, DataType, Table, Model, BelongsToMany, ForeignKey } from "sequelize-typescript";
import { Asset } from "src/assets/assets.model";
import { PortfolioAssets } from "src/assets/portfolio-assets.model";
import { User } from "src/users/users.model";

interface PortfolioCreationAttrs {
  name: string
  type: 'Crypto' | 'Bond' | 'Stock'
  userId: number 
}

@Table({tableName: 'portfolios'}) 
export class Portfolio extends Model<Portfolio, PortfolioCreationAttrs> {
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @Column({type: DataType.STRING, unique: false, allowNull: false})
  name: string 
  
  @Column({type: DataType.STRING, allowNull: false})
  type: 'Crypto' | 'Bond' | 'Stock'

  @BelongsToMany(() => Asset, () => PortfolioAssets)
  assets: Asset[]

  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER, allowNull: false})
  userId: number
}
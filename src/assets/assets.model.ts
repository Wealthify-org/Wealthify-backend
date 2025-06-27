import { Table, Model, Column, DataType, BelongsToMany } from "sequelize-typescript"
import { Portfolio } from "src/portfolio/portfolios.model"
import { PortfolioAssets } from "./portfolio-assets.model"

interface AssetCreationAttrs {
  name: string
  ticker: string
}

@Table({tableName: 'assets'})
export class Asset extends Model<Asset, AssetCreationAttrs> {
  
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @Column({type: DataType.STRING, unique: true, allowNull: false})
  name: string

  @Column({type: DataType.STRING, unique: true, allowNull: false})
  ticker: string

  @Column({type: DataType.STRING, allowNull: false})
  type: 'Crypto' | 'Bond' | 'Stock'

  @BelongsToMany(() => Portfolio, () => PortfolioAssets)
  portfolios: Portfolio[]
}
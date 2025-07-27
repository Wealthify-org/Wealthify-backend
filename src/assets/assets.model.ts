import { Table, Model, Column, DataType, BelongsToMany } from "sequelize-typescript"
import { Portfolio } from "src/portfolio/portfolios.model"
import { PortfolioAssets } from "./portfolio-assets.model"
import { AssetType } from "./asset-type.enum"

interface AssetCreationAttrs {
  name: string
  ticker: string
  type: AssetType
}

@Table({tableName: 'assets'})
export class Asset extends Model<Asset, AssetCreationAttrs> {
  
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @Column({type: DataType.STRING, unique: true, allowNull: false})
  name: string

  @Column({type: DataType.STRING, unique: true, allowNull: false})
  ticker: string

  @Column({type: DataType.ENUM(...Object.values(AssetType)), allowNull: false})
  type: AssetType

  @BelongsToMany(() => Portfolio, () => PortfolioAssets)
  portfolios: Portfolio[]
}
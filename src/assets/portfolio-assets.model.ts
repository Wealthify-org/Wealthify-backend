import { Model, Column, DataType, ForeignKey, Table } from "sequelize-typescript";
import { Asset } from "./assets.model";
import { Portfolio } from "src/portfolio/portfolios.model";

interface PortfolioAssetCreationAttrs {
  portfolioId: number
  assetId: number
  quantity: number
  averageBuyPrice: number
}

@Table({tableName: 'portfolio_assets', createdAt: false, updatedAt: false}) 
export class PortfolioAssets extends Model<PortfolioAssets, PortfolioAssetCreationAttrs> {
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ForeignKey(() => Asset)
  @Column({type: DataType.INTEGER})
  declare assetId: number

  @ForeignKey(() => Portfolio)
  @Column({type: DataType.INTEGER})
  declare portfolioId: number
  
  @Column({type: DataType.DOUBLE})
  declare quantity: number

  @Column({type: DataType.DOUBLE})
  declare averageBuyPrice: number

  @Column({type: DataType.DATE, allowNull: true})
  declare purchaseDate: Date
}

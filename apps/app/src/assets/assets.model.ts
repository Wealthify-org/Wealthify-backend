import { Table, Model, Column, DataType, BelongsToMany } from "sequelize-typescript"
import { Portfolio } from "@app/portfolios/portfolios.model"
import { PortfolioAssets } from "./portfolio-assets.model"
import { AssetType } from "../../../../libs/contracts/src/common/enums/asset-type.enum"
import { ApiProperty } from "@nestjs/swagger"

interface AssetCreationAttrs {
  name: string
  ticker: string
  type: AssetType
}

@Table({tableName: 'assets'})
export class Asset extends Model<Asset, AssetCreationAttrs> {
  
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор актива' })
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({ example: 'Bitcoin', description: 'Полное название актива' })
  @Column({type: DataType.STRING, unique: true, allowNull: false})
  declare name: string

  @ApiProperty({ example: 'BTC', description: 'Тикер (уникальный символьный код) актива' })
  @Column({type: DataType.STRING, unique: true, allowNull: false})
  declare ticker: string

  @ApiProperty({ example: 'Crypto', enum: AssetType, description: 'Тип актива: Crypto, Stock, Bond или Fiat' })
  @Column({type: DataType.ENUM(...Object.values(AssetType)), allowNull: false})
  declare type: AssetType

  @ApiProperty({ type: () => [Portfolio], description: 'Портфели, в которых содержится данный актив', required: false })
  @BelongsToMany(() => Portfolio, () => PortfolioAssets)
  declare portfolios: Portfolio[]
}
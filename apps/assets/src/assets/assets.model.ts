import { Table, Model, Column, DataType, BelongsToMany, HasOne } from "sequelize-typescript"
import { AssetType } from "@libs/contracts"
import { ApiProperty } from "@nestjs/swagger"
import { CryptoAssetData } from "@libs/crypto-data/models"

interface AssetCreationAttrs {
  name: string
  ticker: string
  type: AssetType
  slug?: string | null
}

@Table({tableName: 'assets'})
export class Asset extends Model<Asset, AssetCreationAttrs> {

  @ApiProperty({ example: 1, description: 'Уникальный идентификатор актива' })
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  // name/ticker раньше были UNIQUE — но crypto-обёртки (Mezo Wrapped BTC,
  // Cronos Bridged USDT) делят ticker с оригиналом. Уникальность переехала
  // на slug — см. libs/crypto-data/models/asset.model.ts
  @ApiProperty({ example: 'Bitcoin', description: 'Полное название актива' })
  @Column({type: DataType.STRING, allowNull: false})
  declare name: string

  @ApiProperty({ example: 'BTC', description: 'Тикер актива (НЕ уникален для crypto-обёрток)' })
  @Column({type: DataType.STRING, allowNull: false})
  declare ticker: string

  @ApiProperty({ example: 'bitcoin', description: 'CoinGecko-slug (уникален для crypto)', required: false })
  @Column({type: DataType.STRING, allowNull: true, unique: true})
  declare slug?: string | null

  @ApiProperty({ example: 'Crypto', enum: AssetType, description: 'Тип актива: Crypto, Stock, Bond или Fiat' })
  @Column({type: DataType.ENUM(...Object.values(AssetType)), allowNull: false})
  declare type: AssetType

  @ApiProperty({ type: () => CryptoAssetData, required: false })
  @HasOne(() => CryptoAssetData, {
    foreignKey: 'assetId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare assetData: CryptoAssetData;
  
}
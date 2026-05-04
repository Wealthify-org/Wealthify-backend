import { Model, Column, DataType, ForeignKey, Table, BelongsTo, Index } from "sequelize-typescript";
import { Portfolio } from "../portfolios/portfolios.model";
import { ApiProperty } from "@nestjs/swagger";

interface PortfolioAssetCreationAttrs {
  portfolioId: number
  assetId: number
  quantity: number
  averageBuyPrice: number
}

@Table({
  tableName: 'portfolio_assets',
  createdAt: false,
  updatedAt: false,
  // Композитный уникальный индекс: один и тот же актив не может быть
  // дважды в одном портфеле. Это поддерживает логику service.addAssetToPortfolio
  // (он делает findOne→update vs create) и даёт быстрый join по (portfolioId, assetId).
  // Plus B-tree on portfolioId для cascade-deletes и enrichment-фильтра.
  indexes: [
    { name: 'portfolio_assets_portfolio_id_idx', fields: ['portfolioId'] },
    {
      name: 'portfolio_assets_portfolio_asset_unique',
      unique: true,
      fields: ['portfolioId', 'assetId'],
    },
  ],
})
export class PortfolioAssets extends Model<PortfolioAssets, PortfolioAssetCreationAttrs> {
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор записи связи между активом и портфелем' })
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({ example: 3, description: 'ID актива (внешний ключ на таблицу assets)' })
  @Index('portfolio_assets_asset_id_idx')
  @Column({type: DataType.INTEGER})
  declare assetId: number

  @ApiProperty({ example: 5, description: 'ID портфеля (внешний ключ на таблицу portfolios)' })
  @ForeignKey(() => Portfolio)
  @Column({type: DataType.INTEGER})
  declare portfolioId: number
  
  @ApiProperty({ example: 10.5, description: 'Количество единиц актива, находящихся в портфеле' })
  @Column({type: DataType.DOUBLE})
  declare quantity: number

  @BelongsTo(() => Portfolio)
  declare portfolio: Portfolio;

  @ApiProperty({ example: 1250.75, description: 'Средняя цена покупки одной единицы актива (в USD)' })
  @Column({type: DataType.DOUBLE})
  declare averageBuyPrice: number

  @ApiProperty({ example: '2025-07-20T14:48:00.000Z', description: 'Дата последней покупки актива, используется для отображения или аналитики' })
  @Column({type: DataType.DATE, allowNull: true})
  declare purchaseDate: Date
}

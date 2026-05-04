import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";

interface IndexSnapshotCreationAttrs {
  capturedAt: Date;

  // Fear & Greed
  fearGreedValue: number;
  fearGreedClassification: string;

  // Crypto dominance
  btcDominancePct: number;
  ethDominancePct: number;

  // Crypto market caps
  totalMarketCapUsd: number;
  total2MarketCapUsd: number;
  total3MarketCapUsd: number;
  totalMcapChange24hPct: number;

  // Altseason (computed from CoinGecko top-50 / 30d)
  altseasonScore: number;
  altseasonLabel: string;

  // Traditional indexes
  sp500Value: number;
  sp500Change24hPct: number;
  goldValue: number;
  goldChange24hPct: number;
}

@Table({
  tableName: "index_snapshots",
  timestamps: false,
  // findOne({order:[['capturedAt','DESC']]}) — каждый запрос чата/dashboard.
  // Без индекса PG делает full sort.
  indexes: [
    { name: "index_snapshots_captured_at_idx", fields: ["capturedAt"] },
  ],
})
export class IndexSnapshot extends Model<IndexSnapshot, IndexSnapshotCreationAttrs> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор снэпшота" })
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  declare id: number;

  @ApiProperty({ example: "2026-05-03T18:00:00.000Z", description: "Время фиксации снэпшота" })
  @Column({ type: DataType.DATE, allowNull: false })
  declare capturedAt: Date;

  // ---- Fear & Greed ----

  @ApiProperty({ example: 47, description: "Индекс страха и жадности (0–100)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare fearGreedValue: number;

  @ApiProperty({ example: "Neutral", description: "Текстовая классификация Fear & Greed" })
  @Column({ type: DataType.STRING, allowNull: false })
  declare fearGreedClassification: string;

  // ---- Dominance ----

  @ApiProperty({ example: 58.43, description: "Доминация BTC, %" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare btcDominancePct: number;

  @ApiProperty({ example: 10.43, description: "Доминация ETH, %" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare ethDominancePct: number;

  // ---- Crypto market caps ----

  @ApiProperty({ example: 2696186569311, description: "Капитализация всего крипторынка, USD" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare totalMarketCapUsd: number;

  @ApiProperty({ example: 1120000000000, description: "Капитализация без BTC (TOTAL2), USD" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare total2MarketCapUsd: number;

  @ApiProperty({ example: 840000000000, description: "Капитализация без BTC и ETH (TOTAL3), USD" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare total3MarketCapUsd: number;

  @ApiProperty({ example: 0.32, description: "Изменение капитализации крипторынка за 24ч, %" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare totalMcapChange24hPct: number;

  // ---- Altseason ----

  @ApiProperty({ example: 7, description: "Индекс альтсезона (0–100)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare altseasonScore: number;

  @ApiProperty({
    example: "Bitcoin Season",
    description: "Лейбл: Altseason / Not Altseason / Bitcoin Season",
  })
  @Column({ type: DataType.STRING, allowNull: false })
  declare altseasonLabel: string;

  // ---- Traditional indexes ----

  @ApiProperty({ example: 7230.12, description: "Значение S&P 500" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare sp500Value: number;

  @ApiProperty({ example: 1.32, description: "Изменение S&P 500 за 24ч, %" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare sp500Change24hPct: number;

  @ApiProperty({ example: 4644.5, description: "Цена золота (USD за тройскую унцию)" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare goldValue: number;

  @ApiProperty({ example: 0.32, description: "Изменение цены золота за 24ч, %" })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare goldChange24hPct: number;
}

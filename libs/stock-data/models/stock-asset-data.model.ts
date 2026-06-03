import {
  Table,
  Model,
  Column,
  DataType,
  HasOne,
  ForeignKey,
  Unique,
  BelongsTo,
} from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { Sparkline7D } from '@libs/contracts';
import { Asset } from './asset.model';
import { StockChartsData } from './stock-charts-data.model';

export interface StockAssetCreationAttrs {
  secid: string;
  shortName: string;
  name: string;

  assetId: number;

  boardId?: string | null;
  isin?: string | null;
  currency?: string | null;
  lotSize?: number | null;
  issueSize?: number | null;
  faceValue?: number | null;
  listLevel?: number | null;

  rank?: number | null;
  currentPrice?: number | null;
  prevPrice?: number | null;
  openPrice?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;

  dayChangePct?: number | null;
  change7DPct?: number | null;
  change30DPct?: number | null;
  change1YPct?: number | null;

  marketCap?: number | null;
  valueToday?: number | null;
  volumeToday?: number | null;
  numTrades?: number | null;

  logoUrl?: string | null;
  sparkline7D?: Sparkline7D | null;
  lastUpdatedAt?: Date | null;

  description?: string | null;
  descriptionCheckedAt?: Date | null;
}

@Table({
  tableName: 'stock_assets',
  // listAssets сортирует по rank ASC + offset/limit — без индекса PG делает
  // seq-scan + sort. secid-индекс ускоряет точечный поиск по тикеру.
  indexes: [
    { name: 'stock_assets_rank_idx', fields: ['rank'] },
  ],
})
export class StockAssetData extends Model<StockAssetData, StockAssetCreationAttrs> {
  @ApiProperty({ example: 1, description: 'ID снапшота акции' })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  // MOEX secid — устойчивый уникальный идентификатор инструмента.
  // Используется как conflict-key при upsert'е.
  @ApiProperty({ example: 'SBER', description: 'MOEX secid (тикер, уникален)' })
  @Unique('uq_stock_assets_secid')
  @Column({ type: DataType.STRING(48), allowNull: false })
  declare secid: string;

  @ApiProperty({ example: 'Сбербанк', description: 'Краткое название' })
  @Column({ type: DataType.STRING(256), allowNull: false })
  declare shortName: string;

  @ApiProperty({ example: 'Сбербанк России ПАО ао', description: 'Полное название' })
  @Column({ type: DataType.STRING(512), allowNull: false })
  declare name: string;

  @ApiProperty({ example: 'TQBR', description: 'Режим торгов (board)', required: false })
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare boardId?: string | null;

  @ApiProperty({ example: 'RU0009029540', required: false })
  @Column({ type: DataType.STRING(32), allowNull: true })
  declare isin?: string | null;

  @ApiProperty({ example: 'RUB', required: false })
  @Column({ type: DataType.STRING(8), allowNull: true })
  declare currency?: string | null;

  @ApiProperty({ example: 10, description: 'Размер лота', required: false })
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare lotSize?: number | null;

  @ApiProperty({ example: 21586948000, description: 'Кол-во акций в выпуске', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare issueSize?: number | null;

  @ApiProperty({ example: 3, description: 'Номинал', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare faceValue?: number | null;

  @ApiProperty({ example: 1, description: 'Уровень листинга (1/2/3)', required: false })
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare listLevel?: number | null;

  @ApiProperty({ example: 1, description: 'Ранг по капитализации', required: false })
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare rank?: number | null;

  @ApiProperty({ example: 305.12, description: 'Текущая цена, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare currentPrice?: number | null;

  @ApiProperty({ example: 302.4, description: 'Закрытие предыдущего дня, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare prevPrice?: number | null;

  @ApiProperty({ example: 303.0, description: 'Цена открытия, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare openPrice?: number | null;

  @ApiProperty({ example: 308.5, description: 'Максимум дня, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare highPrice?: number | null;

  @ApiProperty({ example: 301.2, description: 'Минимум дня, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare lowPrice?: number | null;

  @ApiProperty({ example: 0.9, description: 'Изменение за день, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare dayChangePct?: number | null;

  @ApiProperty({ example: 2.4, description: 'Изменение за 7 дней, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change7DPct?: number | null;

  @ApiProperty({ example: -5.1, description: 'Изменение за 30 дней, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change30DPct?: number | null;

  @ApiProperty({ example: 18.3, description: 'Изменение за 1 год, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change1YPct?: number | null;

  @ApiProperty({ example: 6580000000000, description: 'Капитализация, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare marketCap?: number | null;

  @ApiProperty({ example: 12500000000, description: 'Оборот за день, RUB', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare valueToday?: number | null;

  @ApiProperty({ example: 41000000, description: 'Объём за день, штук', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare volumeToday?: number | null;

  @ApiProperty({ example: 85000, description: 'Кол-во сделок за день', required: false })
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare numTrades?: number | null;

  @ApiProperty({ example: '/static/logos/stocks/SBER.png', required: false })
  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare logoUrl?: string | null;

  @ApiProperty({
    description: 'Спарклайн за 7 дней (массив цен), хранится как JSON',
    required: false,
    example: { prices: [301.1, 303.5, 305.2] },
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  declare sparkline7D?: Sparkline7D | null;

  @ApiProperty({ example: '2026-06-02T13:39:03.920Z', required: false })
  @Column({ type: DataType.DATE, allowNull: true })
  declare lastUpdatedAt?: Date | null;

  @ApiProperty({
    example: 'ПАО «Сбербанк» — крупнейший universalьный банк России…',
    required: false,
    description: 'Текстовое описание эмитента (из Википедии, лениво кешируется)',
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  declare description?: string | null;

  // Когда последний раз пытались достать описание — чтобы не дёргать
  // Википедию на каждый просмотр у бумаг, для которых статьи нет.
  @ApiProperty({ required: false })
  @Column({ type: DataType.DATE, allowNull: true })
  declare descriptionCheckedAt?: Date | null;

  // -------- relations --------

  @ApiProperty({ example: 42, required: false })
  @ForeignKey(() => Asset)
  @Unique('uq_stock_assets_asset')
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number;

  @BelongsTo(() => Asset)
  declare asset?: Asset;

  @ApiProperty({ type: () => StockChartsData, required: false })
  @HasOne(() => StockChartsData, {
    foreignKey: 'assetDataId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare charts?: StockChartsData;
}

import { SeriesPoint } from "@app/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { BelongsTo, Column, DataType, ForeignKey, Model, Table, Unique } from "sequelize-typescript";
import { CryptoAssetData } from "./crypto-asset-data.model";

export interface CryptoChartsDataCreationAttrs {
  assetDataId: number;

  // по каждому диапазону: массив пар [timestamp, value]
  h24Stats?: SeriesPoint[];
  h24Volumes?: SeriesPoint[];

  d7Stats?: SeriesPoint[];
  d7Volumes?: SeriesPoint[];

  d30Stats?: SeriesPoint[];
  d30Volumes?: SeriesPoint[];

  d90Stats?: SeriesPoint[];
  d90Volumes?: SeriesPoint[];

  d365Stats?: SeriesPoint[];
  d365Volumes?: SeriesPoint[];

  maxStats?: SeriesPoint[];
  maxVolumes?: SeriesPoint[];

  capturedAt?: Date; // когда зафиксировали графики
}

@Table({ tableName: 'crypto_charts_data' })
export class CryptoChartsData extends Model<CryptoChartsData, CryptoChartsDataCreationAttrs> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 42, description: 'FK на crypto_assets.id (уникально: 1 к 1)' })
  @ForeignKey(() => CryptoAssetData)
  @Unique('uq_charts_asset')
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetDataId: number;

  @BelongsTo(() => CryptoAssetData)
  declare assetData?: CryptoAssetData;

  @ApiProperty({ example: '2025-11-06T12:00:00.000Z', description: 'Момент съёма графиков' })
  @Column({ type: DataType.DATE, allowNull: true })
  declare capturedAt?: Date;

  // helpers: валидация структуры [number, number]
  private static validateSeriesPoints(val: any) {
    if (val == null) return;
    if (!Array.isArray(val)) throw new Error('value must be an array');
    for (const p of val) {
      if (!Array.isArray(p) || p.length < 2) throw new Error('each point must be [t, v]');
      const [t, v] = p;
      if (typeof t !== 'number' || Number.isNaN(t)) throw new Error('timestamp must be number');
      if (typeof v !== 'number' || Number.isNaN(v)) throw new Error('value must be number');
    }
  }

  // 24h
  @ApiProperty({ description: '24h: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare h24Stats?: SeriesPoint[];

  @ApiProperty({ description: '24h: объёмы [timestamp, volume]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare h24Volumes?: SeriesPoint[];

  // 7d 
  @ApiProperty({ description: '7d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d7Stats?: SeriesPoint[];

  @ApiProperty({ description: '7d: объёмы [timestamp, volume]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d7Volumes?: SeriesPoint[];

  // 30d 
  @ApiProperty({ description: '30d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d30Stats?: SeriesPoint[];

  @ApiProperty({ description: '30d: объёмы [timestamp, volume]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d30Volumes?: SeriesPoint[];

  // 90d 
  @ApiProperty({ description: '90d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d90Stats?: SeriesPoint[];

  @ApiProperty({ description: '90d: объёмы [timestamp, volume]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d90Volumes?: SeriesPoint[];

  // 365d 
  @ApiProperty({ description: '365d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d365Stats?: SeriesPoint[];

  @ApiProperty({ description: '365d: объёмы [timestamp, volume]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare d365Volumes?: SeriesPoint[];

  // max 
  @ApiProperty({ description: 'max: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare maxStats?: SeriesPoint[];

  @ApiProperty({ description: 'max: объёмы [timestamp, volume]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { CryptoChartsData.validateSeriesPoints(val); } },
  })
  declare maxVolumes?: SeriesPoint[];
}

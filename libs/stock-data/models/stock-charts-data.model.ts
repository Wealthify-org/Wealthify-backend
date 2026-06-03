import { SeriesPoint } from '@libs/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
  Unique,
} from 'sequelize-typescript';
import { StockAssetData } from './stock-asset-data.model';

export interface StockChartsDataCreationAttrs {
  assetDataId: number;

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

  capturedAt?: Date;
}

@Table({ tableName: 'stock_charts_data' })
export class StockChartsData extends Model<StockChartsData, StockChartsDataCreationAttrs> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 42, description: 'FK на stock_assets.id (1:1)' })
  @ForeignKey(() => StockAssetData)
  @Unique('uq_stock_charts_asset')
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetDataId: number;

  @BelongsTo(() => StockAssetData)
  declare assetData?: StockAssetData;

  @ApiProperty({ example: '2026-06-02T12:00:00.000Z', description: 'Момент съёма графиков' })
  @Column({ type: DataType.DATE, allowNull: true })
  declare capturedAt?: Date;

  // Валидация структуры [number, number]: защищаемся от мусора в JSONB.
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
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare h24Stats?: SeriesPoint[];

  @ApiProperty({ description: '24h: объёмы [timestamp, value]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare h24Volumes?: SeriesPoint[];

  // 7d
  @ApiProperty({ description: '7d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d7Stats?: SeriesPoint[];

  @ApiProperty({ description: '7d: объёмы [timestamp, value]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d7Volumes?: SeriesPoint[];

  // 30d
  @ApiProperty({ description: '30d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d30Stats?: SeriesPoint[];

  @ApiProperty({ description: '30d: объёмы [timestamp, value]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d30Volumes?: SeriesPoint[];

  // 90d
  @ApiProperty({ description: '90d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d90Stats?: SeriesPoint[];

  @ApiProperty({ description: '90d: объёмы [timestamp, value]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d90Volumes?: SeriesPoint[];

  // 365d
  @ApiProperty({ description: '365d: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d365Stats?: SeriesPoint[];

  @ApiProperty({ description: '365d: объёмы [timestamp, value]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare d365Volumes?: SeriesPoint[];

  // max
  @ApiProperty({ description: 'max: ценовые точки [timestamp, price]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare maxStats?: SeriesPoint[];

  @ApiProperty({ description: 'max: объёмы [timestamp, value]' })
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    validate: { isSeries(val: any) { StockChartsData.validateSeriesPoints(val); } },
  })
  declare maxVolumes?: SeriesPoint[];
}

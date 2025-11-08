import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { CryptoAssetData } from "./crypto-asset-data.model";

/* TODO */

export enum CandleInterval {
  MIN1 = '1m',
  MIN5 = '5m',
  MIN15 = '15m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d',
  W1 = '1w',
  M1 = '1mo',
}

export interface CryptoCandleCreationAttrs {
  assetId: number;
  interval: CandleInterval;
  openTime: Date;           // начало свечи
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;          // объём в базовой валюте
  marketCapUsd?: string;    // опционально
}

@Table({
  tableName: 'crypto_candles',
  timestamps: true,
  indexes: [
    { fields: ['assetId'] },
    { fields: ['interval'] },
    // уникальная свеча на интервал
    { unique: true, fields: ['assetId', 'interval', 'openTime'] },
  ],
})
export class CryptoCandle extends Model<CryptoCandle, CryptoCandleCreationAttrs> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 1, description: 'ID из crypto_assets' })
  @ForeignKey(() => CryptoAssetData)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number;

  @ApiProperty({ enum: CandleInterval, example: CandleInterval.D1 })
  @Column({ type: DataType.ENUM(...Object.values(CandleInterval)), allowNull: false })
  declare interval: CandleInterval;

  @ApiProperty({ example: '2025-10-24T00:00:00.000Z', description: 'Начало окна интервала' })
  @Column({ type: DataType.DATE, allowNull: false })
  declare openTime: Date;

  @ApiProperty({ example: '67000.123456' })
  @Column({ type: DataType.DECIMAL(30, 12), allowNull: false })
  declare open: string;

  @ApiProperty({ example: '68050.987654' })
  @Column({ type: DataType.DECIMAL(30, 12), allowNull: false })
  declare high: string;

  @ApiProperty({ example: '66500.000000' })
  @Column({ type: DataType.DECIMAL(30, 12), allowNull: false })
  declare low: string;

  @ApiProperty({ example: '67500.123400' })
  @Column({ type: DataType.DECIMAL(30, 12), allowNull: false })
  declare close: string;

  @ApiProperty({ example: '1234.5678', required: false, description: 'Объём за свечу' })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare volume?: string;

  @ApiProperty({ example: '1340000000000', required: false, description: 'Market Cap (снимок на close)' })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare marketCapUsd?: string;

  @BelongsTo(() => CryptoAssetData)
  declare asset?: CryptoAssetData;
}

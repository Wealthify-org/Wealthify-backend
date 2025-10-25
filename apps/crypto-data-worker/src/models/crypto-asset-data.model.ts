// apps/crypto-data-worker/src/models/crypto-asset.model.ts
import { Table, Model, Column, DataType, HasMany, Index } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { CryptoCandle } from "./crypto-candle.model";

export interface CryptoAssetCreationAttrs {
  ticker: string;
  name: string;
  description?: string;
  slug?: string;
  logoUrl?: string;
  websiteUrl?: string;
  sector?: string;           // категория/сектор (Layer1, DeFi, NFT и т.п.)
  source?: string;           // источник данных (coingecko, cmc, binance и т.п.)
  isActive?: boolean;

  // snapshot метрики (опционально, воркер обновляет периодически)
  priceUsd?: string;         // DECIMAL как строка
  priceBtc?: string;
  marketCapUsd?: string;
  volume24hUsd?: string;
  change1hPct?: string;
  change24hPct?: string;
  change7dPct?: string;
  circulatingSupply?: string;
  totalSupply?: string;
  maxSupply?: string;
  rank?: number;
  sparkline7d?: any;         // массив чисел, храним в JSONB
  lastUpdatedAt?: Date;
}

@Table({
  tableName: 'crypto_assets',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['ticker'] },
    { fields: ['slug'] },
    { fields: ['isActive'] },
    { fields: ['rank'] },
  ],
})
export class CryptoAsset extends Model<CryptoAsset, CryptoAssetCreationAttrs> {
  @ApiProperty({ example: 1, description: 'ID актива' })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 'BTC', description: 'Уникальный тикер' })
  @Index({ unique: true })
  @Column({ type: DataType.STRING(32), allowNull: false, unique: true })
  declare ticker: string;

  @ApiProperty({ example: 'Bitcoin', description: 'Название актива' })
  @Column({ type: DataType.STRING(256), allowNull: false })
  declare name: string;

  @ApiProperty({ example: 'Первая и крупнейшая криптовалюта…', required: false })
  @Column({ type: DataType.TEXT, allowNull: true })
  declare description?: string;

  @ApiProperty({ example: 'bitcoin', description: 'ЧПУ-идентификатор (из источника)', required: false })
  @Column({ type: DataType.STRING(256), allowNull: true })
  declare slug?: string;

  @ApiProperty({ example: 'https://assets.coingecko.com/coins/images/1/large.png', required: false })
  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare logoUrl?: string;

  @ApiProperty({ example: 'https://bitcoin.org', required: false })
  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare websiteUrl?: string;

  @ApiProperty({ example: 'Layer1', required: false })
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare sector?: string;

  @ApiProperty({ example: 'coingecko', required: false })
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare source?: string;

  @ApiProperty({ example: true, description: 'Актив торгуется/активен', required: false })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  // -------- snapshot метрики (decimal -> string) --------

  @ApiProperty({ example: '68000.123456', description: 'Текущая цена в USD (snapshot)', required: false })
  @Column({ type: DataType.DECIMAL(30, 12), allowNull: true })
  declare priceUsd?: string;

  @ApiProperty({ example: '1.00000000', description: 'Цена в BTC (для альтов)', required: false })
  @Column({ type: DataType.DECIMAL(30, 12), allowNull: true })
  declare priceBtc?: string;

  @ApiProperty({ example: '1340000000000', description: 'Рыночная капитализация USD', required: false })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare marketCapUsd?: string;

  @ApiProperty({ example: '32000000000', description: 'Объём торгов за 24ч USD', required: false })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare volume24hUsd?: string;

  @ApiProperty({ example: '0.52', description: 'Изменение за 1ч, %', required: false })
  @Column({ type: DataType.DECIMAL(20, 8), allowNull: true })
  declare change1hPct?: string;

  @ApiProperty({ example: '-2.15', description: 'Изменение за 24ч, %', required: false })
  @Column({ type: DataType.DECIMAL(20, 8), allowNull: true })
  declare change24hPct?: string;

  @ApiProperty({ example: '5.42', description: 'Изменение за 7д, %', required: false })
  @Column({ type: DataType.DECIMAL(20, 8), allowNull: true })
  declare change7dPct?: string;

  @ApiProperty({ example: '19500000', description: 'В обращении', required: false })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare circulatingSupply?: string;

  @ApiProperty({ example: '21000000', description: 'Всего выпущено', required: false })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare totalSupply?: string;

  @ApiProperty({ example: '21000000', description: 'Максимальная эмиссия', required: false })
  @Column({ type: DataType.DECIMAL(38, 12), allowNull: true })
  declare maxSupply?: string;

  @ApiProperty({ example: 1, description: 'Ранг по рыночной капитализации', required: false })
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare rank?: number;

  @ApiProperty({
    description: 'Спарклайн за 7 дней (массив цен), хранится как JSON',
    required: false,
    example: { prices: [67000.1, 67125.5, 66543.2] },
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  declare sparkline7d?: any;

  @ApiProperty({ example: '2025-10-24T13:39:03.920Z', description: 'Время последнего обновления снапшота', required: false })
  @Column({ type: DataType.DATE, allowNull: true })
  declare lastUpdatedAt?: Date;

  // -------- relations --------

  @ApiProperty({ type: () => [CryptoCandle], required: false })
  @HasMany(() => CryptoCandle)
  declare candles?: CryptoCandle[];
}

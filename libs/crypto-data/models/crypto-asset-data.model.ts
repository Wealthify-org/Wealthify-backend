import { Table, Model, Column, DataType, HasMany, Index, HasOne, ForeignKey, Unique, BelongsTo } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { Sparkline7D } from '@libs/contracts';
import { CryptoChartsData } from './crypto-charts-data.model';
import { Asset } from './asset.model';

export interface CryptoAssetCreationAttrs {
  ticker: string;
  name: string;

  assetId: number;

  description?: string;
  descriptionRu?: string;
  slug?: string;
  logoUrl?: string | null;

  categories?: string;
  
  source?: string;

  rank?: number;
  currentPriceUsd?: number;
  
  marketCapUsd?: number;
  fdvUsd?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply: string | null;
  contractAddress?: string | null;
  volume24HUsd?: number

  change1HUsdPct?: number;
  change24HUsdPct?: number;
  change7DUsdPct?: number;
  change14DUsdPct?: number;
  change30DUsdPct?: number;
  change1YUsdPct?: number;

  sparkline7D?: Sparkline7D;
  lastUpdatedAt?: Date;
}

@Table({
  tableName: 'crypto_assets',
  // `listAssets` сортирует по rank ASC + offset/limit. Без индекса PG делает
  // seq-scan + sort на сотни тысяч строк (с гипотетическим расширением).
  indexes: [
    { name: 'crypto_assets_rank_idx', fields: ['rank'] },
  ],
})
export class CryptoAssetData extends Model<CryptoAssetData, CryptoAssetCreationAttrs> {
  @ApiProperty({ example: 1, description: 'ID актива' })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  // Раньше ticker был UNIQUE — но у CoinGecko ticker не уникален
  // (Bitcoin и Mezo Wrapped BTC оба имеют ticker='BTC'). Это приводило
  // к перезаписи Bitcoin'а wrapped-вариантом при upsert'е. Уникальность
  // переехала на slug (CoinGecko-ID).
  @ApiProperty({ example: 'BTC', description: 'Тикер актива (НЕ уникален: bridged/wrapped монеты делят его с оригиналом)' })
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare ticker: string;

  @ApiProperty({ example: 'Bitcoin', description: 'Название актива' })
  @Column({ type: DataType.STRING(256), allowNull: false })
  declare name: string;

  @ApiProperty({ example: 'Первая и крупнейшая криптовалюта…', required: false })
  @Column({ type: DataType.TEXT, allowNull: true })
  declare description?: string;

  @ApiProperty({
    example: 'Биткоин — первая в мире децентрализованная криптовалюта…',
    required: false,
    description:
      'Русский перевод description (HTML-safe, делается лениво при первом ' +
      'запросе с lang=ru, кешируется в БД).',
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  declare descriptionRu?: string;

  // CoinGecko slug — единственный устойчивый идентификатор. Используется
  // как conflict-key при upsert'е. allowNull=true оставлен для legacy-
  // строк, у которых slug ещё не заполнен (старый парсер не писал его).
  @ApiProperty({ example: 'bitcoin', description: 'CoinGecko-slug (уникален)', required: false })
  @Column({ type: DataType.STRING(256), allowNull: true, unique: true })
  declare slug?: string;

  @ApiProperty({ example: 'https://assets.coingecko.com/coins/images/1/large.png', required: false })
  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare logoUrl?: string | null;
  
  @ApiProperty({
    example: '/static/logos/crypto/1.png',
    required: false,
    description: 'Локальный URL логотипа (через твой CDN/статику)',
  })
  @Column({ type: DataType.STRING(1024), allowNull: true })
  declare logoUrlLocal: string | null;

  @ApiProperty({ example: 'Layer1;Store of Value', required: false })
  @Column({ type: DataType.TEXT, allowNull: true })
  declare categories?: string;

  @ApiProperty({ example: 'coingecko', required: false })
  @Column({ type: DataType.TEXT, allowNull: true })
  declare source?: string;

  @ApiProperty({ example: 1, description: 'Ранг по рыночной капитализации', required: false })
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare rank?: number;

  @ApiProperty({ example: '68000.123456', description: 'Текущая цена в USD (snapshot)', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare currentPriceUsd?: number;

  @ApiProperty({ example: '1340000000000', description: 'Рыночная капитализация USD', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare marketCapUsd?: number;

  @ApiProperty({ example: '1340000000', description: 'Полностью разводнённая капитализация USD' })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare fdvUsd: number;

  @ApiProperty({ example: '19500000', description: 'В обращении', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare circulatingSupply?: number;

  @ApiProperty({ example: '21000000', description: 'Всего выпущено', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare totalSupply?: number;

 @ApiProperty({ example: '21000000', description: 'Максимальная эмиссия. Может быть числом в строке или unnlimited', required: false })
  @Column({ type: DataType.STRING, allowNull: true, })
  declare maxSupply: string | null;

  @ApiProperty({
    example: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    description: "Основной смарт-контракт токена (ERC-20, BEP-20 и т.п.)",
    required: false,
  })
  @Column({ type: DataType.STRING(128), allowNull: true })
  declare contractAddress: string | null; 

  @ApiProperty({ example: '32000000000', description: 'Объём торгов за 24ч USD', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare volume24HUsd?: number;

  @ApiProperty({ example: '0.52', description: 'Изменение за 1ч, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change1HUsdPct?: number;

  @ApiProperty({ example: '-2.15', description: 'Изменение за 24ч, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change24HUsdPct?: number;

  @ApiProperty({ example: '5.42', description: 'Изменение за 7д, %', required: false })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change7DUsdPct?: number;

  @ApiProperty({ example: '-5.42', description: 'Изменение за 14 дней, %' })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change14DUsdPct?: number;

  @ApiProperty({ example: '-54.42', description: 'Изменение за 30 дней, %' })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change30DUsdPct?: number;

  @ApiProperty({ example: '-54.42', description: 'Изменение за 1 год, %' })
  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare change1YUsdPct?: number;

  @ApiProperty({
    description: 'Спарклайн за 7 дней (массив цен), хранится как JSON',
    required: false,
    example: { prices: [67000.1, 67125.5, 66543.2] },
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  declare sparkline7D?: Sparkline7D;

  @ApiProperty({ example: '2025-10-24T13:39:03.920Z', description: 'Время последнего обновления снапшота', required: false })
  @Column({ type: DataType.DATE, allowNull: true })
  declare lastUpdatedAt?: Date;

  // -------- relations --------

  @ApiProperty({ example: 42, required: false })
  @ForeignKey(() => Asset)
  @Unique('uq_assets_data')
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number

  @BelongsTo(() => Asset)
  declare asset?: Asset;
  
  // связь 1:1 с таблицей графиков
  @ApiProperty({ type: () => CryptoChartsData, required: false })
  @HasOne(() => CryptoChartsData, {
    foreignKey: 'assetDataId',     // имя fk в таблице CryptoChartsData
    onDelete: 'CASCADE',        // удаляем графики при удалении актива
    onUpdate: 'CASCADE',
  })
  declare charts?: CryptoChartsData;

  // @ApiProperty({ type: () => [CryptoCandle], required: false })
  // @HasMany(() => CryptoCandle)
  // declare candles?: CryptoCandle[];
}

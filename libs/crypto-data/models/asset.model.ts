import { ApiProperty } from '@nestjs/swagger';
import { Column, DataType, HasOne, Model, Table } from 'sequelize-typescript';
import { AssetType } from '@libs/contracts';
import { CryptoAssetData } from './crypto-asset-data.model';

interface WorkerAssetCreationAttrs {
  name: string;
  ticker: string;
  type: AssetType;
  slug?: string | null;
}

@Table({ tableName: 'assets' }) // та же таблица, что и в app
export class Asset extends Model<Asset, WorkerAssetCreationAttrs> {
  @ApiProperty({ example: 1, description: 'ID актива' })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  // name/ticker раньше были UNIQUE — но это ломалось на crypto, где
  // у обёрток (Mezo Wrapped BTC) тот же ticker, что у оригинала (BTC).
  // Уникальность переехала на slug.
  @ApiProperty({ example: 'Bitcoin', description: 'Полное название актива' })
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @ApiProperty({ example: 'BTC', description: 'Тикер актива (НЕ уникален для crypto-обёрток)' })
  @Column({ type: DataType.STRING, allowNull: false })
  declare ticker: string;

  // CoinGecko slug — уникальный ID. Заполняется только парсером для
  // crypto. Для stocks/bonds остаётся NULL (PG позволяет много NULL
  // в unique-индексе).
  @ApiProperty({ example: 'bitcoin', description: 'CoinGecko-slug (для crypto, уникален)', required: false })
  @Column({ type: DataType.STRING, allowNull: true, unique: true })
  declare slug?: string | null;

  @ApiProperty({ example: 'Crypto', enum: AssetType })
  @Column({ type: DataType.ENUM(...Object.values(AssetType)), allowNull: false })
  declare type: AssetType;

  @HasOne(() => CryptoAssetData, {
    foreignKey: 'assetId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare assetData: CryptoAssetData;
}

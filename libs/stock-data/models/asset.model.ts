import { ApiProperty } from '@nestjs/swagger';
import { Column, DataType, HasOne, Model, Table } from 'sequelize-typescript';
import { AssetType } from '@libs/contracts';
import { StockAssetData } from './stock-asset-data.model';

interface StockAssetRefCreationAttrs {
  name: string;
  ticker: string;
  type: AssetType;
  slug?: string | null;
}

/**
 * Stock-сторонняя проекция общей таблицы `assets`. Колонки 1:1 совпадают с
 * crypto-сторонним `Asset` (libs/crypto-data) и с `assets`-app — это та же
 * физическая таблица. Отдельный класс нужен только чтобы привязать
 * ассоциацию HasOne именно к StockAssetData внутри процесса stock-воркера
 * (crypto-модели в этом процессе не регистрируются).
 *
 * Воркеры — разные процессы с разными соединениями Sequelize, поэтому
 * наличие двух model-классов на одну таблицу в разных процессах безопасно.
 */
@Table({ tableName: 'assets' })
export class Asset extends Model<Asset, StockAssetRefCreationAttrs> {
  @ApiProperty({ example: 1, description: 'ID актива' })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 'Сбербанк России', description: 'Полное название актива' })
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @ApiProperty({ example: 'SBER', description: 'Тикер актива' })
  @Column({ type: DataType.STRING, allowNull: false })
  declare ticker: string;

  // Для акций slug = MOEX secid (например 'SBER'). Уникален. Для crypto тут
  // CoinGecko-slug; типы (STOCK/CRYPTO) разводят неймспейсы, а PG-уникальность
  // регистрозависима, поэтому коллизий 'SBER' (stock) ↔ 'sber' (crypto) нет.
  @ApiProperty({ example: 'SBER', description: 'Уникальный slug (для акций = MOEX secid)', required: false })
  @Column({ type: DataType.STRING, allowNull: true, unique: true })
  declare slug?: string | null;

  @ApiProperty({ example: 'Stock', enum: AssetType })
  @Column({ type: DataType.ENUM(...Object.values(AssetType)), allowNull: false })
  declare type: AssetType;

  @HasOne(() => StockAssetData, {
    foreignKey: 'assetId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare stockData?: StockAssetData;
}

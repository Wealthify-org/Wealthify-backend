import { ApiProperty } from '@nestjs/swagger';
import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { AssetType } from '@app/contracts';

interface WorkerAssetCreationAttrs {
  name: string;
  ticker: string;
  type: AssetType;
}

@Table({ tableName: 'assets' }) // та же таблица, что и в app
export class Asset extends Model<Asset, WorkerAssetCreationAttrs> {
  @ApiProperty({ example: 1, description: 'ID актива' })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 'Bitcoin', description: 'Полное название актива' })
  @Column({ type: DataType.STRING, unique: true, allowNull: false })
  declare name: string;

  @ApiProperty({ example: 'BTC', description: 'Тикер актива' })
  @Column({ type: DataType.STRING, unique: true, allowNull: false })
  declare ticker: string;

  @ApiProperty({ example: 'Crypto', enum: AssetType })
  @Column({ type: DataType.ENUM(...Object.values(AssetType)), allowNull: false })
  declare type: AssetType;
}

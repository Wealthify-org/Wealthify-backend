import { Table, Model, Column, DataType } from "sequelize-typescript";
import { ApiProperty } from "@nestjs/swagger";

interface FavoriteAssetCreationAttrs {
  userId: number;
  assetId: number;
}

@Table({
  tableName: "favorite_assets",
  timestamps: true,
  updatedAt: false,
  indexes: [
    { name: "ux_favorite_user_asset", unique: true, fields: ["userId", "assetId"] },
    { name: "ix_favorite_user_created", fields: ["userId", "createdAt"] },
  ],
})
export class FavoriteAsset extends Model<FavoriteAsset, FavoriteAssetCreationAttrs> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @ApiProperty({ example: 42 })
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number;

  @ApiProperty({ example: "2025-12-19T12:00:00.000Z" })
  @Column({ type: DataType.DATE, allowNull: false })
  declare createdAt: Date;
}

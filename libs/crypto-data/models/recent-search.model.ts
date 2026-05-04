import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Asset } from "./asset.model";

interface RecentSearchCreationAttrs {
  userId: number;
  assetId: number;
}

@Table({
  tableName: "recent_searches",
  timestamps: true,
  updatedAt: false,
  // — (userId, createdAt DESC) для `list` (последние N запросов юзера)
  // — composite unique (userId, assetId) под upsert-pattern в `add()`
  indexes: [
    { name: "recent_searches_user_created_idx", fields: ["userId", "createdAt"] },
    {
      name: "recent_searches_user_asset_unique",
      unique: true,
      fields: ["userId", "assetId"],
    },
  ],
})
export class RecentSearch extends Model<RecentSearch, RecentSearchCreationAttrs> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @ForeignKey(() => Asset)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number;

  @BelongsTo(() => Asset)
  declare asset?: Asset;
}

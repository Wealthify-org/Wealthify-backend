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

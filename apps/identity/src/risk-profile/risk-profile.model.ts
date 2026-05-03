import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { User } from "../users/users.model";
import { RiskBucket } from "@libs/contracts";

interface RiskProfileCreationAttrs {
  userId: number;
  score: number;
  bucket: RiskBucket;
  answers: Array<{ questionId: string; optionId: string; weight: number }>;
}

@Table({ tableName: "risk_profiles" })
export class RiskProfile extends Model<RiskProfile, RiskProfileCreationAttrs> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор риск-профиля" })
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  declare id: number;

  @ApiProperty({ example: 7, description: "ID пользователя-владельца профиля" })
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  declare userId: number;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  declare user: User;

  @ApiProperty({
    example: 6.4,
    description: "Итоговый балл риск-профиля (1.0 – 10.0)",
  })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare score: number;

  @ApiProperty({
    example: "Aggressive",
    enum: RiskBucket,
    description: "Бакет риск-профиля",
  })
  @Column({
    type: DataType.ENUM(...Object.values(RiskBucket)),
    allowNull: false,
  })
  declare bucket: RiskBucket;

  @ApiProperty({
    description: "Сохранённые ответы пользователя для аудита и пересчёта",
    example: [
      { questionId: "q1_horizon_when_need_money", optionId: "5_10y", weight: 9 },
    ],
  })
  @Column({ type: DataType.JSONB, allowNull: false })
  declare answers: Array<{
    questionId: string;
    optionId: string;
    weight: number;
  }>;
}

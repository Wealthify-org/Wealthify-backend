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
import { ChatHistoryRole } from "@libs/contracts";

interface ChatMessageCreationAttrs {
  userId: number;
  role: ChatHistoryRole;
  content: string;
}

@Table({ tableName: "chat_messages", timestamps: true, updatedAt: false })
export class ChatMessage extends Model<ChatMessage, ChatMessageCreationAttrs> {
  @ApiProperty({ example: 1, description: "Уникальный ID сообщения" })
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  declare id: number;

  @ApiProperty({ example: 7, description: "ID пользователя-владельца сообщения" })
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  declare user: User;

  @ApiProperty({
    example: "user",
    enum: ["user", "assistant"],
    description: "Роль сообщения",
  })
  @Column({
    type: DataType.ENUM("user", "assistant"),
    allowNull: false,
  })
  declare role: ChatHistoryRole;

  @ApiProperty({ description: "Текст сообщения" })
  @Column({ type: DataType.TEXT, allowNull: false })
  declare content: string;
}

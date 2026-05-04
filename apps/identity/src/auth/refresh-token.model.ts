import { ApiProperty } from "@nestjs/swagger";
import { Column, DataType, ForeignKey, Model, Table, Index } from "sequelize-typescript";
import { User } from "../users/users.model";

interface RefreshTokenCreationAttrs {
  token: string,
  userId: number,
  expiryDate: Date
}

@Table({tableName: 'refresh-token'})
export class RefreshToken extends Model<RefreshToken, RefreshTokenCreationAttrs> {
  @ApiProperty({example: 1, description: 'Айди токена'})
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({example: '-', description: 'SHA256-хеш значение токена (индексируется для O(1) lookup)'})
  @Index('refresh_token_token_idx')
  @Column({type: DataType.STRING, allowNull: false})
  declare token: string


  // Раньше userId был UNIQUE — это ломало multi-device/multi-tab:
  // вход с другого устройства (или просто бутстрап во второй вкладке)
  // вытеснял refresh-токен первого, и первое устройство тихо
  // разлогинивалось при следующем refresh. Один пользователь может
  // иметь много валидных refresh-токенов — устаревшие вычищаются по
  // expiryDate.
  @ApiProperty({example: 5, description: 'Айди пользователя (НЕ уникален: много токенов = много устройств/вкладок)'})
  @ForeignKey(() => User)
  @Index('refresh_token_user_id_idx')
  @Column({type: DataType.INTEGER, allowNull: false})
  declare userId: number

  @ApiProperty({example: '2025-07-20T14:48:00.000Z', description: 'Дата истечения срока жизни токена'})
  @Index('refresh_token_expiry_date_idx')
  @Column({type: DataType.DATE, allowNull: false})
  declare expiryDate: Date
}
import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Asset } from "@app/assets/assets.model";
import { Portfolio } from "@app/portfolios/portfolios.model";
import { TransactionType } from "@libs/contracts/common/enums/transaction-type.enum"
import { ApiProperty } from "@nestjs/swagger";

interface TransactionCreationAttrs {
  portfolioId: number
  assetId: number
  type: TransactionType
  quantity: number
  pricePerUnit: number
  date: Date
}

@Table({ tableName: 'transactions' })
export class Transaction extends Model<Transaction, TransactionCreationAttrs> {

  @ApiProperty({ example: 1, description: 'Уникальный идентификатор транзакции' })
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({ example: 2, description: 'ID портфеля, к которому относится транзакция' })
  @ForeignKey(() => Portfolio)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare portfolioId: number

  @ApiProperty({ example: 5, description: 'ID актива, участвующего в транзакции' })
  @ForeignKey(() => Asset)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number

  @ApiProperty({ example: TransactionType.BUY, enum: TransactionType, description: 'Тип транзакции: покупка или продажа' })
  @Column({ type: DataType.ENUM(...Object.values(TransactionType)), allowNull: false })
  declare type: TransactionType

  @ApiProperty({ example: 10.5, description: 'Количество актива в транзакции' })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare quantity: number

  @ApiProperty({ example: 1200.75, description: 'Цена за единицу актива на момент транзакции' })
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare pricePerUnit: number

  @ApiProperty({ example: '2024-07-21T14:30:00Z', description: 'Дата и время транзакции' })
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare date: Date
}
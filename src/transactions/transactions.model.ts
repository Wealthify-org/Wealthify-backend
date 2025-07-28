import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Asset } from "src/assets/assets.model";
import { Portfolio } from "src/portfolio/portfolios.model";
import { TransactionType } from "./transaction-type.enum";

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

  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ForeignKey(() => Portfolio)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare portfolioId: number

  @ForeignKey(() => Asset)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number

  @Column({ type: DataType.ENUM(...Object.values(TransactionType)), allowNull: false })
  declare type: TransactionType

  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare quantity: number

  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare pricePerUnit: number

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare date: Date
}
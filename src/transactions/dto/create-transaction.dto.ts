import { TransactionType } from "../transaction-type.enum"


export class CreateTransactionDto {
  readonly portfolioId: number
  readonly assetId: number
  readonly type: TransactionType
  readonly quantity: number
  readonly pricePerUnit: number
  readonly date: Date
}
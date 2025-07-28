import { ApiProperty } from '@nestjs/swagger'
import { TransactionType } from '../transaction-type.enum'

export class CreateTransactionDto {
  @ApiProperty({ example: 12, description: 'ID портфеля, к которому относится транзакция' })
  readonly portfolioId: number

  @ApiProperty({ example: 5, description: 'ID актива, связанного с транзакцией' })
  readonly assetId: number

  @ApiProperty({ example: TransactionType.BUY, description: 'Тип транзакции: BUY (покупка) или SELL (продажа)', enum: TransactionType })
  readonly type: TransactionType

  @ApiProperty({ example: 3.5, description: 'Количество актива, участвующее в транзакции' })
  readonly quantity: number

  @ApiProperty({ example: 26500.75, description: 'Цена за единицу актива на момент транзакции (в USD)' })
  readonly pricePerUnit: number

  @ApiProperty({ example: '2025-07-21T14:30:00Z', description: 'Дата и время выполнения транзакции' })
  readonly date: Date
}

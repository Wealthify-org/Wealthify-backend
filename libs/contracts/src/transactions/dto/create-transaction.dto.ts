import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { TransactionType } from '../../common/enums/transaction-type.enum';

export const CreateTransactionSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .positive()
      .describe('ID портфеля, к которому относится транзакция'),

    assetId: z
      .coerce.number()
      .int()
      .positive()
      .describe('ID актива, связанного с транзакцией'),

    type: z
      .nativeEnum(TransactionType)
      .describe('Тип транзакции: BUY (покупка) или SELL (продажа)'),

    quantity: z
      .coerce.number()
      .finite()
      .positive('quantity must be greater than 0')
      .describe('Количество актива, участвующее в транзакции'),

    pricePerUnit: z
      .coerce.number()
      .finite()
      .nonnegative('pricePerUnit must be ≥ 0')
      .describe('Цена за единицу актива на момент транзакции (в USD)'),

    date: z
      .coerce.date()
      .describe('Дата и время выполнения транзакции'),
  })
  .strict();

export class CreateTransactionDto extends createZodDto(CreateTransactionSchema) {}

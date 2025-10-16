import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DeleteAllLinkedTransactionsSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .describe('ID портфеля, из которого будут удалены все связанные транзакции'),
    assetId: z
      .coerce.number()
      .int()
      .describe('ID актива, по которому будут удалены все связанные транзакции'),
  })
  .strict();

export class DeleteAllLinkedTransactionsDto extends createZodDto(
  DeleteAllLinkedTransactionsSchema,
) {}

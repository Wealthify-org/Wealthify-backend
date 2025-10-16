import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RemoveAssetFromPortfolioSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .describe('ID портфеля, из которого удаляется актив'),
    assetTicker: z
      .string()
      .min(1, 'assetTicker is required')
      .describe('Тикер удаляемого актива'),
    removeAllLinkedTransactions: z
      .coerce.boolean()
      .describe('Удалять ли все связанные транзакции с этим активом'),
  })
  .strict();

export class RemoveAssetFromPortfolioDto extends createZodDto(
  RemoveAssetFromPortfolioSchema,
) {}

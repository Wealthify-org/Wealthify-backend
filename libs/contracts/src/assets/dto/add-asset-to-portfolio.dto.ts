import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AddAssetToPortfolioSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .describe('Айди портфеля, в который добавляется актив'),
    assetTicker: z
      .string()
      .min(1, 'assetTicker is required')
      .describe('Тикер актива, который добавляется в портфель'),
    quantity: z
      .coerce.number()
      .describe('Количество единиц актива, который добавляется в портфель'),
    purchasePrice: z
      .coerce.number()
      .describe('Цена, по которой актив добавляется в портфель (в USD)'),
  })
  .strict();

export class AddAssetToPortfolioDto extends createZodDto(
  AddAssetToPortfolioSchema,
) {}
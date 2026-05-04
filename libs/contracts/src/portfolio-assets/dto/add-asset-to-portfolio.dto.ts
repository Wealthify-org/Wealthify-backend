import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AddAssetToPortfolioSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .positive('portfolioId must be a positive integer')
      .describe('Айди портфеля, в который добавляется актив'),
    assetTicker: z
      .string()
      .min(1, 'assetTicker is required')
      .max(64, 'assetTicker is too long')
      .describe('Тикер актива, который добавляется в портфель'),
    quantity: z
      .coerce.number()
      .finite('quantity must be a finite number')
      .positive('quantity must be greater than 0')
      .describe('Количество единиц актива, который добавляется в портфель'),
    purchasePrice: z
      .coerce.number()
      .finite('purchasePrice must be a finite number')
      .positive('purchasePrice must be greater than 0')
      .describe('Цена, по которой актив добавляется в портфель (в USD)'),
  })
  .strict();

export class AddAssetToPortfolioDto extends createZodDto(
  AddAssetToPortfolioSchema,
) {}

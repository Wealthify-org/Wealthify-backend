import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SellAssetSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .describe('ID портфеля, в котором продаётся актив'),
    assetTicker: z
      .string()
      .min(1, 'assetTicker is required')
      .describe('Тикер продаваемого актива'),
    quantity: z
      .coerce.number()
      .describe('Количество продаваемого актива'),
    convertToUsd: z
      .coerce.boolean()
      .optional()
      .describe('Нужно ли конвертировать выручку от продажи в доллары (добавить USD в портфель)'),
    pricePerUnit: z
      .coerce.number()
      .describe('Цена за одну единицу актива в момент продажи (в USD)'),
  })
  .strict();

export class SellAssetDto extends createZodDto(SellAssetSchema) {}

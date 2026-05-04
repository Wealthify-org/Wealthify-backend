import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SellAssetSchema = z
  .object({
    portfolioId: z
      .coerce.number()
      .int()
      .positive('portfolioId must be a positive integer')
      .describe('ID портфеля, в котором продаётся актив'),
    assetTicker: z
      .string()
      .min(1, 'assetTicker is required')
      .max(64, 'assetTicker is too long')
      .describe('Тикер продаваемого актива'),
    quantity: z
      .coerce.number()
      .finite('quantity must be a finite number')
      .positive('quantity must be greater than 0')
      .describe('Количество продаваемого актива'),
    convertToUsd: z
      .coerce.boolean()
      .optional()
      .describe('Нужно ли конвертировать выручку от продажи в доллары (добавить USD в портфель)'),
    pricePerUnit: z
      .coerce.number()
      .finite('pricePerUnit must be a finite number')
      .positive('pricePerUnit must be greater than 0')
      .describe('Цена за одну единицу актива в момент продажи (в USD)'),
  })
  .strict();

export class SellAssetDto extends createZodDto(SellAssetSchema) {}

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { AssetType } from '../asset-type.enum';

export const CreateAssetSchema = z
  .object({
    name: z.string().min(1, 'name is required').describe('Название актива'),
    ticker: z.string().min(1, 'ticker is required').describe('Тикер актива'),
    type: z
      .nativeEnum(AssetType)
      .describe(
        'Тип актива: Crypto (криптовалюты), Stock (акции), Bond (облигации), Fiat (фиатные деньги)',
      ),
  })
  .strict();

export class CreateAssetDto extends createZodDto(CreateAssetSchema) {}

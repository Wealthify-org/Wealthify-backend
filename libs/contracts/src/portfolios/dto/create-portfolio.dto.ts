import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PortfolioType } from "../../common/enums/portfolio-type.enum"

export const CreatePortfolioSchema = z
  .object({
    name: z
      .string()
      .min(1, 'name is required')
      .describe('Название портфеля, задаётся пользователем'),

    type: z
      .nativeEnum(PortfolioType)
      .describe('Тип портфеля: Crypto, Stock, Bond или Fiat'),

    userId: z
      .coerce.number()
      .int()
      .describe('ID пользователя, которому принадлежит портфель'),
  })
  .strict();

export class CreatePortfolioDto extends createZodDto(CreatePortfolioSchema) {}

// refresh-token.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RefreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, 'refreshToken is required')
      .describe('Рефреш токен пользователя'),
    
    userId: z
      .coerce.number()
      .int()
      .describe('Айди пользователя, которому принадлежит токен'),
  })
  .strict();

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}

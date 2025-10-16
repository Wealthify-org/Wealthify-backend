// forgot-password.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email().describe('Почта пользователя'),
  })
  .strict();

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

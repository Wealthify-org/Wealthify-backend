// change-password.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'oldPassword is required').describe('Пароль пользователя, который меняют'),

    newPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters long')
      .regex(/\d/, 'Password must contain at least one number')
      .describe('Пароль, на который меняют'),
  })
  .strict();

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

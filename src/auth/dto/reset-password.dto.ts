import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ResetPasswordSchema = z
  .object({
    resetToken: z
      .string()
      .min(1, 'resetToken is required')
      .describe('Токен для смены пароля пользователем'),

    newPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters long')
      .regex(/\d/, 'Password must contain at least one number')
      .describe('Новый пароль пользователя'),

    userId: z
      .coerce.number()
      .int()
      .describe('Айди пользователя, которому меняют пароль'),
  })
  .strict();

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

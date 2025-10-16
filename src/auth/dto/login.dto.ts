import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  ALLOWED_SYMBOLS,
  HAS_ALLOWED_SYMBOL,
  ONLY_ALLOWED_CHARS,
} from '../../common/validation/password.constants';

export const LoginSchema = z
  .object({
    email: z
      .string()
      .transform((v) => String(v).trim().toLowerCase())
      .pipe(z.string().email('Invalid email address'))
      .describe('Почта пользователя'),

    password: z
      .string()
      .min(12, 'Password must be at least 12 characters long')
      .max(72, 'Password must be at most 72 characters long')
      .regex(ONLY_ALLOWED_CHARS, `Use letters, digits and only: ${ALLOWED_SYMBOLS}`)
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/\d/, 'Must include a number')
      .regex(HAS_ALLOWED_SYMBOL, `Must include at least one of: ${ALLOWED_SYMBOLS}`)
      .describe('Пароль пользователя'),
  })
  .strict(); // запрет лишних полей (как forbidNonWhitelisted)

export class LoginDto extends createZodDto(LoginSchema) {}

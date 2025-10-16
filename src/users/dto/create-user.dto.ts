import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  ALLOWED_SYMBOLS,
  HAS_ALLOWED_SYMBOL,
  ONLY_ALLOWED_CHARS,
} from '../../common/validation/password.constants';

export const CreateUserSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be 3-30 characters')
      .max(30, 'Username must be 3-30 characters')
      // только латиница, цифры и _ . - , начинается с буквы
      .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, "Use letters, digits, '_', '.', '-' (must start with a letter)")
      // не заканчивается спецсимволом
      .regex(/[A-Za-z0-9]$/, "Cannot end with '_', '.' or '-'")
      // без двух спецсимволов подряд
      .regex(/^(?!.*[_.-]{2,}).*$/, 'No consecutive special characters')
      // не только цифры
      .regex(/(?!^\d+$)^.+$/, 'Username cannot be only digits')
      .describe('Никнейм пользователя'),

    email: z
      .string()
      .transform((v) => String(v).trim().toLowerCase())
      .pipe(z.string().email('Invalid email address'))
      .describe('Почта пользователя'),

    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(ONLY_ALLOWED_CHARS, `Use letters, digits and only these symbols: ${ALLOWED_SYMBOLS}`)
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/\d/, 'Must include a number')
      .regex(HAS_ALLOWED_SYMBOL, `Must include at least one of: ${ALLOWED_SYMBOLS}`)
      .describe('Пароль пользователя'),
  })
  .strict();

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

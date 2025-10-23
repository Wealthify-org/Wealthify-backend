import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AddRoleSchema = z
  .object({
    userId: z
      .coerce.number()
      .int()
      .describe('ID пользователя, которому мы добавляем роль'),
    value: z
      .string()
      .min(1, 'value is required')
      .describe('Роль, которую мы выдаем'),
  })
  .strict();

export class AddRoleDto extends createZodDto(AddRoleSchema) {}

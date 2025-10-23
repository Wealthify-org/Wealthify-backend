import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateRoleSchema = z
  .object({
    value: z.string().min(1, 'value is required').describe('Название роли пользователя'),
    description: z.string().min(1, 'description is required').describe('Описание роли пользователя'),
  })
  .strict();

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

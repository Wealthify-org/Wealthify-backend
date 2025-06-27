import { ApiProperty } from "@nestjs/swagger"

export class CreateRoleDto {
  @ApiProperty({example: 'ADMIN', description: 'Название роли пользователя'})
  readonly value: string
  @ApiProperty({example: 'Администратор', description: 'Описание роли пользователя'})
  readonly description: string
}
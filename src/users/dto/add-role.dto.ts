import { ApiProperty } from "@nestjs/swagger"

export class AddRoleDto {
  @ApiProperty({example: 5, description: 'ID пользователя, которому мы добавляем роль'})
  readonly userId: number
  @ApiProperty({example: 'ADMIN', description: 'Роль, которую мы выдаем'})
  readonly value: string
}
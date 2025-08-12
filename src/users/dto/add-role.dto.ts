import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsString } from "class-validator"

export class AddRoleDto {
  @ApiProperty({example: 5, description: 'ID пользователя, которому мы добавляем роль'})
  @IsInt()
  readonly userId: number
  @ApiProperty({example: 'ADMIN', description: 'Роль, которую мы выдаем'})
  @IsString()
  readonly value: string
}
import { ApiProperty } from "@nestjs/swagger"
import { IsString } from "class-validator"

export class CreateRoleDto {
  @ApiProperty({example: 'ADMIN', description: 'Название роли пользователя'})
  @IsString()
  readonly value: string
  @ApiProperty({example: 'Администратор', description: 'Описание роли пользователя'})
  @IsString()
  readonly description: string
}
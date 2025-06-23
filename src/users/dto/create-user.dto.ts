import { ApiProperty } from "@nestjs/swagger"

export class CreateUserDto {
  
  @ApiProperty({example: 'outea7t', description: 'Никнейм пользователя'})
  readonly username: string
  @ApiProperty({example: 'user@mail.ru', description: 'Почта пользователя'})
  readonly email: string
  @ApiProperty({example: 'asdfa123', description: 'Пароль пользователя'})
  readonly password: string
}
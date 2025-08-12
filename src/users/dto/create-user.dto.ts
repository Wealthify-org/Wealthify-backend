import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsString, Matches, MinLength } from "class-validator"

export class CreateUserDto {
  @ApiProperty({example: 'outea7t', description: 'Никнейм пользователя'})
  @IsString()
  readonly username: string
  @ApiProperty({example: 'user@mail.ru', description: 'Почта пользователя'})
  @IsEmail()
  readonly email: string
  @ApiProperty({example: 'asdfa123', description: 'Пароль пользователя'})
  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  readonly password: string
}
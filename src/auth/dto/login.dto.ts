import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString} from 'class-validator'

export class LoginDto {
  @ApiProperty({example: 'user@mail.com', description: 'Почта пользователя'})
  @IsEmail()
  readonly email: string

  @ApiProperty({example: 'password123', description: 'Пароль пользователя'})
  @IsString()
  readonly password: string
}
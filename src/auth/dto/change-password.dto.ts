import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches, MinLength } from "class-validator"

export class ChangePasswordDto {
  @ApiProperty({example: 'password123', description: 'Пароль пользователя, который меняют'})
  @IsString()
  readonly oldPassword: string

  @ApiProperty({example: 'newPassword123', description: 'Пароль, на который меняют'})
  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  readonly newPassword: string
}
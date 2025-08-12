import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({example: '-', description: 'Токен для смены пароля пользователем'})
  @IsString()
  readonly resetToken: string

  @ApiProperty({example: 'newPassword123', description: 'Новый пароль пользователя'})
  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  readonly newPassword: string 

  @ApiProperty({example: '1', description: 'Айди пользователя, которому меняют пароль'})
  @IsInt()
  readonly userId: number
}
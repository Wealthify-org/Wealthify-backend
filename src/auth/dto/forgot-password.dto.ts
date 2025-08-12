import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({example: 'user@mail.com', description: 'Почта пользователя'})
  @IsEmail()
  readonly email: string
}
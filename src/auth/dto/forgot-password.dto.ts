import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail()
  readonly email: string
}
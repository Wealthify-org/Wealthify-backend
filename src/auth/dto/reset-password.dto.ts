import { IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  readonly resetToken: string

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  readonly newPassword: string 
}
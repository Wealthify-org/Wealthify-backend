import { IsString, Matches, MinLength } from "class-validator"

export class ChangePasswordDto {
  @IsString()
  readonly oldPassword: string

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  readonly newPassword: string
}
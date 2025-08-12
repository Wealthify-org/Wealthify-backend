import { IsInt, IsString } from "class-validator";

export class RefreshTokenDto {
  @IsString()
  readonly refreshToken: string

  @IsInt()
  readonly userId: number
}
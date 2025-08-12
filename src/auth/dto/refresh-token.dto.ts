import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({example: '-', description: 'Рефреш токен пользователя'})
  @IsString()
  readonly refreshToken: string

  @ApiProperty({example: '1', description: 'Айди пользователя, которому принадлежит токен'})
  @IsInt()
  readonly userId: number
}
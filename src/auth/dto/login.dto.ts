import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { ALLOWED_SYMBOLS, HAS_ALLOWED_SYMBOL, ONLY_ALLOWED_CHARS } from "../../common/validation/password.constants";

export class LoginDto {
  @ApiProperty({ example: "user@mail.com", description: "Почта пользователя" })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: "Invalid email address" })
  readonly email: string;

  @ApiProperty({ example: "P@s7w_rd-password", description: "Пароль пользователя" })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(ONLY_ALLOWED_CHARS, { message: `Use letters, digits and only: ${ALLOWED_SYMBOLS}` })
  @Matches(/[a-z]/, { message: "Must include a lowercase letter" })
  @Matches(/[A-Z]/, { message: "Must include an uppercase letter" })
  @Matches(/\d/,    { message: "Must include a number" })
  @Matches(HAS_ALLOWED_SYMBOL, { message: `Must include at least one of: ${ALLOWED_SYMBOLS}` })
  readonly password: string;
}

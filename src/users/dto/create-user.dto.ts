import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail, IsString, Length, Matches, MaxLength, MinLength
} from "class-validator";
import { ALLOWED_SYMBOLS, HAS_ALLOWED_SYMBOL, ONLY_ALLOWED_CHARS } from "../../common/validation/password.constants";

export class CreateUserDto {
  @ApiProperty({ example: "outea7t", description: "Никнейм пользователя" })
  @IsString()
  @Length(3, 30, { message: "Username must be 3-30 characters" })
  // только латиница, цифры и _ . - , начинается с буквы
  @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/, {
    message: "Use letters, digits, '_', '.', '-' (must start with a letter)",
  })
  // не заканчивается спецсимволом
  @Matches(/[A-Za-z0-9]$/, { message: "Cannot end with '_', '.' or '-'" })
  // без двух спецсимволов подряд
  @Matches(/^(?!.*[_.-]{2,}).*$/, { message: "No consecutive special characters" })
  // не только цифры
  @Matches(/(?!^\d+$)^.+$/, { message: "Username cannot be only digits" })
  readonly username: string;

  @ApiProperty({ example: "user@mail.ru", description: "Почта пользователя" })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: "Invalid email address" })
  readonly email: string;

  @ApiProperty({ example: "Aa12!aaaa....", description: "Пароль пользователя" })
  @IsString()
  @MinLength(12, { message: "Password must be at least 12 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  // только разрешённые символы
  @Matches(ONLY_ALLOWED_CHARS, {
    message: `Use letters, digits and only these symbols: ${ALLOWED_SYMBOLS}`,
  })
  // классы символов
  @Matches(/[a-z]/, { message: "Must include a lowercase letter" })
  @Matches(/[A-Z]/, { message: "Must include an uppercase letter" })
  @Matches(/\d/,    { message: "Must include a number" })
  @Matches(HAS_ALLOWED_SYMBOL, {
    message: `Must include at least one of: ${ALLOWED_SYMBOLS}`,
  })
  readonly password: string;
}

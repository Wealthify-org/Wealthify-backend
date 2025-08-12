import { ApiProperty } from "@nestjs/swagger"
import { PortfolioType } from "../portfolio-type.enum"
import { IsEnum, IsInt, IsString } from "class-validator"

export class CreatePortfolioDto {
  @ApiProperty({ example: 'My Investments', description: 'Название портфеля, задаётся пользователем' })
  @IsString()
  readonly name: string

  @ApiProperty({ example: 'Crypto', enum: PortfolioType, description: 'Тип портфеля: Crypto, Stock, Bond или Fiat' })
  @IsEnum(PortfolioType)
  readonly type: PortfolioType

  @ApiProperty({ example: 42, description: 'ID пользователя, которому принадлежит портфель' })
  @IsInt()
  readonly userId: number
}
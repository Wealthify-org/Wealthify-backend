import { ApiProperty } from "@nestjs/swagger"
import { PortfolioType } from "../portfolio-type.enum"

export class CreatePortfolioDto {
  @ApiProperty({ example: 'My Investments', description: 'Название портфеля, задаётся пользователем' })
  readonly name: string

  @ApiProperty({ example: 'Crypto', enum: PortfolioType, description: 'Тип портфеля: Crypto, Stock, Bond или Fiat' })
  readonly type: PortfolioType

  @ApiProperty({ example: 42, description: 'ID пользователя, которому принадлежит портфель' })
  readonly userId: number
}
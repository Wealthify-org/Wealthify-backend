import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsInt, IsString } from "class-validator"

export class RemoveAssetFromPortfolioDto {
  @ApiProperty({ example: 1, description: 'ID портфеля, из которого удаляется актив' })
  @IsInt()
  readonly portfolioId: number

  @ApiProperty({ example: 'BTC', description: 'Тикер удаляемого актива' })
  @IsString()
  readonly assetTicker: string

  @ApiProperty({ example: true, description: 'Удалять ли все связанные транзакции с этим активом' })
  @IsBoolean()
  readonly removeAllLinkedTransactions: boolean
}
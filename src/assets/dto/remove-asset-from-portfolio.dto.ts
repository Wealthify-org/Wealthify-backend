import { ApiProperty } from "@nestjs/swagger"

export class RemoveAssetFromPortfolioDto {
  @ApiProperty({ example: 1, description: 'ID портфеля, из которого удаляется актив' })
  readonly portfolioId: number

  @ApiProperty({ example: 'BTC', description: 'Тикер удаляемого актива' })
  readonly assetTicker: string

  @ApiProperty({ example: true, description: 'Удалять ли все связанные транзакции с этим активом' })
  readonly removeAllLinkedTransactions: boolean
}
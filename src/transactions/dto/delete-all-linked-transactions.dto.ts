import { ApiProperty } from "@nestjs/swagger"

export class DeleteAllLinkedTransactionsDto {
  @ApiProperty({ example: 1, description: 'ID портфеля, из которого будут удалены все связанные транзакции' })
  readonly portfolioId: number
  @ApiProperty({ example: 5, description: 'ID актива, по которому будут удалены все связанные транзакции' })
  readonly assetId: number
}
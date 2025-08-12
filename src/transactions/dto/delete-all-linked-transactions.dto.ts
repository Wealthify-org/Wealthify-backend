import { ApiProperty } from "@nestjs/swagger"
import { IsInt } from "class-validator"

export class DeleteAllLinkedTransactionsDto {
  @ApiProperty({ example: 1, description: 'ID портфеля, из которого будут удалены все связанные транзакции' })
  @IsInt()
  readonly portfolioId: number
  @ApiProperty({ example: 5, description: 'ID актива, по которому будут удалены все связанные транзакции' })
  @IsInt()
  readonly assetId: number
}
import { ApiProperty } from "@nestjs/swagger"

export class SellAssetDto {
  @ApiProperty({ example: 1, description: 'ID портфеля, в котором продаётся актив' })
  readonly portfolioId: number

  @ApiProperty({ example: 'BTC', description: 'Тикер продаваемого актива' })
  readonly assetTicker: string

  @ApiProperty({ example: 2.5, description: 'Количество продаваемого актива' })
  readonly quantity: number

  @ApiProperty({ example: true, description: 'Нужно ли конвертировать выручку от продажи в доллары (добавить USD в портфель)' })
  readonly convertToUsd?: boolean

  @ApiProperty({ example: 105000, description: 'Цена за одну единицу актива в момент продажи (в USD)' })
  readonly pricePerUnit: number
}
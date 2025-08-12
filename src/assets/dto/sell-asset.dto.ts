import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsInt, IsNumber, IsString } from "class-validator"

export class SellAssetDto {
  @ApiProperty({ example: 1, description: 'ID портфеля, в котором продаётся актив' })
  @IsInt()
  readonly portfolioId: number

  @ApiProperty({ example: 'BTC', description: 'Тикер продаваемого актива' })
  @IsString()
  readonly assetTicker: string

  @ApiProperty({ example: 2.5, description: 'Количество продаваемого актива' })
  @IsNumber()
  readonly quantity: number

  @ApiProperty({ example: true, description: 'Нужно ли конвертировать выручку от продажи в доллары (добавить USD в портфель)' })
  @IsBoolean()
  readonly convertToUsd?: boolean

  @ApiProperty({ example: 105000, description: 'Цена за одну единицу актива в момент продажи (в USD)' })
  @IsNumber()
  readonly pricePerUnit: number
}
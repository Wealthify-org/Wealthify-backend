import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsNumber, IsString } from "class-validator"


export class AddAssetToPortfolioDto {
  @ApiProperty({example: '1', description: 'Айди портфеля, в который добавляется актив'})
  @IsInt()
  readonly portfolioId: number

  @ApiProperty({example: '1', description: 'Айди актива, который добавляется в портфель'})
  @IsString()
  readonly assetTicker: string

  @ApiProperty({example: '2.5', description: 'Количество единиц актива, который добавляется в портфель'})
  @IsNumber()
  readonly quantity: number
  
  @ApiProperty({example: '300', description: 'Цена, по которой актив добавляется в портфель (в USD)'})
  @IsNumber()
  readonly purchasePrice: number
}
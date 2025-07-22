import { ApiProperty } from "@nestjs/swagger"


export class AddAssetToPortfolioDto {
  @ApiProperty({example: '1', description: 'Айди портфеля, в который добавляется актив'})
  readonly portfolioId: number

  @ApiProperty({example: '1', description: 'Айди актива, который добавляется в портфель'})
  readonly assetTicker: string

  @ApiProperty({example: '2.5', description: 'Количество единиц актива, который добавляется в портфель'})
  readonly quantity: number
  
  @ApiProperty({example: '300', description: 'Цена, по которой актив добавляется в портфель'})
  readonly purchasePrice: number
}
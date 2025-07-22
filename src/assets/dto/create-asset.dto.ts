import { ApiProperty } from "@nestjs/swagger"

export class CreateAssetDto {
  @ApiProperty({ example: 'Bitcoin' })
  readonly name: string

  @ApiProperty({ example: 'BTC' })
  readonly ticker: string

  @ApiProperty({ example: 'Crypto' })
  readonly type: 'Crypto' | 'Bond' | 'Stock' | 'Fiat'
}
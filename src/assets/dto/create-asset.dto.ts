import { ApiProperty } from "@nestjs/swagger"
import { AssetType } from "../asset-type.enum"

export class CreateAssetDto {
  @ApiProperty({ example: 'Bitcoin' })
  readonly name: string

  @ApiProperty({ example: 'BTC' })
  readonly ticker: string

  @ApiProperty({ example: 'Crypto' })
  readonly type: AssetType
}
import { ApiProperty } from "@nestjs/swagger"
import { AssetType } from "../asset-type.enum"

export class CreateAssetDto {
  @ApiProperty({ example: 'Bitcoin', description: 'Название актива' })
  readonly name: string

  @ApiProperty({ example: 'BTC', description: 'Тикер актива' })
  readonly ticker: string

  @ApiProperty({ example: 'Crypto', enum: AssetType, description: 'Тип актива, может быть Crypto - для криптовалют, Stock - для акций, Bond - для облигаций или Fiat - для фиатных денег' })
  readonly type: AssetType
}
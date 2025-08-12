import { ApiProperty } from "@nestjs/swagger"
import { AssetType } from "../asset-type.enum"
import { IsEnum, IsString } from "class-validator"

export class CreateAssetDto {
  @ApiProperty({ example: 'Bitcoin', description: 'Название актива' })
  @IsString()
  readonly name: string

  @ApiProperty({ example: 'BTC', description: 'Тикер актива' })
  @IsString()
  readonly ticker: string

  @ApiProperty({ example: 'Crypto', enum: AssetType, description: 'Тип актива, может быть Crypto - для криптовалют, Stock - для акций, Bond - для облигаций или Fiat - для фиатных денег' })
  @IsEnum(AssetType)
  readonly type: AssetType
}
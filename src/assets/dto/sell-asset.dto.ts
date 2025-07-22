
export class SellAssetDto {
  readonly portfolioId: number
  readonly assetTicker: string
  readonly quantity: number
  readonly convertToUsd?: boolean
  readonly pricePerUnit: number
}
export class AddAssetToPortfolioDto {
  readonly portfolioId: number
  readonly assetTicker: string
  readonly quantity: number
  readonly purchasePrice: number
}
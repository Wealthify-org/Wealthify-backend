
export class RemoveAssetFromPortfolioDto {
  readonly portfolioId: number
  readonly assetTicker: string
  readonly removeAllLinkedTransactions: boolean
}
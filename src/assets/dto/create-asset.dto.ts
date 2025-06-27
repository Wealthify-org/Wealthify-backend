export class CreateAssetDto {
  readonly name: string
  readonly ticker: string
  readonly type: 'Crypto' | 'Bond' | 'Stock'
}
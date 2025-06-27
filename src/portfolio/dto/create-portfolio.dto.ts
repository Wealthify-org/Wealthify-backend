

export class CreatePortfolioDto {
  readonly name: string
  readonly type: 'Crypto' | 'Bond' | 'Stock'
  readonly userId: number
}
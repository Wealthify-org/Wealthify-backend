import { PortfolioType } from "../portfolio-type.enum"


export class CreatePortfolioDto {
  readonly name: string
  readonly type: PortfolioType
  readonly userId: number
}
import { Controller } from '@nestjs/common';
import { CreatePortfolioDto } from "@libs/contracts";
import { PortfoliosService } from './portfolios.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PORTFOLIOS_PATTERNS } from '@libs/contracts/portfolios/portfolios.pattern';

@Controller()
export class PortfoliosController {
  constructor(private readonly portfolioService: PortfoliosService) {}

  @MessagePattern(PORTFOLIOS_PATTERNS.CREATE)
  create(@Payload() dto: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(dto)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER)
  getAll(@Payload() payload: { userId: number }) {
    return this.portfolioService.getAllPortfolios(payload.userId)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.FIND_BY_NAME)
  getByName(@Payload() payload: {name: string}) {
    return this.portfolioService.getPortfolioByName(payload.name)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.DELETE_BY_ID)
  delete(@Payload() payload: {id: number}) {
    return this.portfolioService.deletePortfolio(payload.id)
  }
}

import { Controller } from '@nestjs/common';
import { CreatePortfolioDto } from "@libs/contracts";
import { PortfoliosService } from './portfolios.service';
import { PortfolioHistoryService } from './portfolio-history.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PORTFOLIOS_PATTERNS } from '@libs/contracts/portfolios/portfolios.pattern';
import { ValueHistoryPeriod } from '@libs/contracts/portfolios/dto/value-history.dto';

@Controller()
export class PortfoliosController {
  constructor(
    private readonly portfolioService: PortfoliosService,
    private readonly historyService: PortfolioHistoryService,
  ) {}

  @MessagePattern(PORTFOLIOS_PATTERNS.CREATE)
  create(@Payload() dto: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(dto)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER)
  getAll(@Payload() payload: { userId: number }) {
    return this.portfolioService.getAllPortfolios(payload.userId)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.FIND_BY_NAME)
  getByName(@Payload() payload: { name: string; userId: number }) {
    return this.portfolioService.getPortfolioByName(payload.name, payload.userId)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.FIND_DETAIL_BY_ID)
  getDetailById(@Payload() payload: { id: number; userId: number }) {
    return this.portfolioService.getPortfolioDetailById(payload.id, payload.userId)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.USER_SUMMARY) 
  getUserSummary(@Payload() payload: { userId: number }) {
    return this.portfolioService.getUserSummary(payload.userId);
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.SET_CURRENCY)
  setCurrency(
    @Payload() payload: { id: number; userId: number; currency: string },
  ) {
    return this.portfolioService.setDisplayCurrency(
      payload.id,
      payload.userId,
      payload.currency,
    );
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.DELETE_BY_ID)
  delete(@Payload() payload: { id: number; userId: number }) {
    return this.portfolioService.deletePortfolio(payload.id, payload.userId)
  }

  @MessagePattern(PORTFOLIOS_PATTERNS.VALUE_HISTORY)
  valueHistory(
    @Payload()
    payload: { id: number; userId: number; period: ValueHistoryPeriod },
  ) {
    return this.historyService.getValueHistory(payload.id, payload.period);
  }
}

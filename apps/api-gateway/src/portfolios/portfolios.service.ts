import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { PORTFOLIO_CLIENT } from "./constant";
import { PORTFOLIOS_PATTERNS } from '@libs/contracts/portfolios/portfolios.pattern';
import { CreatePortfolioDto, RECOMMENDATIONS_PATTERNS } from '@libs/contracts';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class PortfoliosService {
  constructor(@Inject(PORTFOLIO_CLIENT) private readonly appMs: ClientProxy) {}

  createPortfolio(dto: CreatePortfolioDto) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.CREATE, dto);
  }

  getAllPortfolios(userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER, { userId });
  }

  getPortfolioByName(name: string) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_BY_NAME, { name });
  }

  getPortfolioDetailById(id: number, userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_DETAIL_BY_ID, { id, userId });
  }

  getUserSummary(userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.USER_SUMMARY, { userId });
  }

  deletePortfolio(id: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.DELETE_BY_ID, { id });
  }

  getRecommendations(portfolioId: number, userId: number) {
    // увеличиваем таймаут — LLM может отвечать до 25 секунд
    return sendOrThrow(
      this.appMs,
      RECOMMENDATIONS_PATTERNS.GENERATE_FOR_PORTFOLIO,
      { portfolioId, userId },
      45_000,
    );
  }
}

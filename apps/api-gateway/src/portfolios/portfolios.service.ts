import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { PORTFOLIO_CLIENT } from "./constant";
import { PORTFOLIOS_PATTERNS } from '@libs/contracts/portfolios/portfolios.pattern';
import { CreatePortfolioDto, RECOMMENDATIONS_PATTERNS } from '@libs/contracts';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';
import { ValueHistoryPeriod } from '@libs/contracts/portfolios/dto/value-history.dto';

@Injectable()
export class PortfoliosService {
  constructor(@Inject(PORTFOLIO_CLIENT) private readonly appMs: ClientProxy) {}

  createPortfolio(dto: CreatePortfolioDto) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.CREATE, dto);
  }

  getAllPortfolios(userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER, { userId });
  }

  getPortfolioByName(name: string, userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_BY_NAME, {
      name,
      userId,
    });
  }

  getPortfolioDetailById(id: number, userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_DETAIL_BY_ID, { id, userId });
  }

  getUserSummary(userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.USER_SUMMARY, { userId });
  }

  deletePortfolio(id: number, userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.DELETE_BY_ID, {
      id,
      userId,
    });
  }

  setDisplayCurrency(id: number, userId: number, currency: string) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.SET_CURRENCY, {
      id,
      userId,
      currency,
    });
  }

  async getValueHistory(
    id: number,
    userId: number,
    period: ValueHistoryPeriod,
  ) {
    // Сначала проверяем ownership через FIND_DETAIL_BY_ID — он уже умеет
    // 403/404 для чужих/несуществующих. Без этого юзер мог запросить
    // value-history любого portfolio-id (RPC принимает голый id).
    await sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_DETAIL_BY_ID, {
      id,
      userId,
    });

    // RPC может занять до ~30с (несколько чартов параллельно через
    // crypto-data-worker + аккуратные таймауты в самом сервисе).
    return sendOrThrow(
      this.appMs,
      PORTFOLIOS_PATTERNS.VALUE_HISTORY,
      { id, userId, period },
      45_000,
    );
  }

  getRecommendations(portfolioId: number, userId: number, lang?: 'ru' | 'en') {
    // увеличиваем таймаут — LLM может отвечать до 25 секунд
    return sendOrThrow(
      this.appMs,
      RECOMMENDATIONS_PATTERNS.GENERATE_FOR_PORTFOLIO,
      { portfolioId, userId, lang },
      45_000,
    );
  }
}

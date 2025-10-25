import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { APP_CLIENT } from "./constant";
import { PORTFOLIOS_PATTERNS } from '@app/contracts/portfolios/portfolios.pattern';
import { CreatePortfolioDto } from '@app/contracts';
import { sendOrThrow } from '@app/contracts/common/rpc/client';

@Injectable()
export class PortfoliosService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createPortfolio(dto: CreatePortfolioDto) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.CREATE, dto);
  }

  getAllPortfolios(userId: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER, { userId });
  }

  getPortfolioByName(name: string) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.FIND_BY_NAME, { name });
  }

  deletePortfolio(id: number) {
    return sendOrThrow(this.appMs, PORTFOLIOS_PATTERNS.DELETE_BY_ID, { id });
  }
}

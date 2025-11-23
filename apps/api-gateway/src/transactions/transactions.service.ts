import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { PORTFOLIO_CLIENT } from "./constant";
import { TRANSACTIONS_PATTERNS } from '@libs/contracts/transactions/transactions.pattern';
import { sendOrThrow } from '@libs/contracts/common/rpc/client';

@Injectable()
export class TransactionsService {
  constructor(@Inject(PORTFOLIO_CLIENT) private readonly appMs: ClientProxy) {}

  getAllTransactions() {
    return sendOrThrow(this.appMs, TRANSACTIONS_PATTERNS.FIND_ALL, {});
  }

  getAllPortfolioTransactions(portfolioId: number) {
    return sendOrThrow(this.appMs, TRANSACTIONS_PATTERNS.FIND_ALL_BY_PORTFOLIO, { id: portfolioId });
  }

  deleteTransaction(id: number) {
    return sendOrThrow(this.appMs, TRANSACTIONS_PATTERNS.DELETE_BY_ID, { id });
  }
}

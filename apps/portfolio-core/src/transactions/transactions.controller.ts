import { Controller } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TRANSACTIONS_PATTERNS } from '@libs/contracts/transactions/transactions.pattern';


@Controller()
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @MessagePattern(TRANSACTIONS_PATTERNS.FIND_ALL)
  getAll() {
    return this.transactionService.getAllTransactions();
  }

  @MessagePattern(TRANSACTIONS_PATTERNS.FIND_ALL_BY_PORTFOLIO)
  getAllPortfolioTransactions(@Payload() payload: { id: number }) {
    return this.transactionService.getAllPortfolioTransactions(payload.id);
  }

  @MessagePattern(TRANSACTIONS_PATTERNS.DELETE_BY_ID)
  delete(@Payload() payload: { id: number }) {
    return this.transactionService.deleteTransaction(payload.id)
  }
}

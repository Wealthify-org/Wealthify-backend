import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}
  
  @Get()
  getAll() {
    return this.transactionService.getAllTransactions();
  }

  @Get(':id')
  getAllPortfolioTransactions(@Param('id') id: string) {
    return this.transactionService.getAllPortfolioTransactions(Number(id));
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.transactionService.deleteTransaction(Number(id))
  }
}

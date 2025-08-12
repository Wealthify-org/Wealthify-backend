import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Transaction } from './transactions.model';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles-auth.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';

console.log('TRANSACTIONS: RolesGuard type:', typeof RolesGuard, typeof JwtAuthGuard);

@ApiTags('Транзакции')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}
  
  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Получить все транзакции всех портфелей' })
  @ApiResponse({ status: 200, description: 'Список всех транзакций', type: [Transaction] })
  getAll() {
    return this.transactionService.getAllTransactions();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить все транзакции конкретного портфеля' })
  @ApiParam({ name: 'id', description: 'ID портфеля', example: 1 })
  @ApiResponse({ status: 200, description: 'Список транзакций для указанного портфеля', type: [Transaction] })
  getAllPortfolioTransactions(@Param('id') id: string) {
    return this.transactionService.getAllPortfolioTransactions(Number(id));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Удалить транзакцию по ID' })
  @ApiParam({ name: 'id', description: 'ID транзакции', example: 3 })
  @ApiResponse({ status: 200, description: 'Транзакция успешно удалена и связанный актив обновлён или удалён' })
  @ApiResponse({ status: 404, description: 'Транзакция не найдена' })
  @ApiResponse({ status: 500, description: 'Не удалось создать или обновить информацию об активе' })
  delete(@Param('id') id: string) {
    return this.transactionService.deleteTransaction(Number(id))
  }
}

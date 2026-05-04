import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { TransactionsService } from './transactions.service';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { RolesGuard } from '@gateway/common/guards/roles.guard';
import { Roles } from '@gateway/common/decorators/roles-auth.decorator';
import { CurrentUser } from '@gateway/common/decorators/сurrent-user.decorator';

@ApiTags('Транзакции')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Получить все транзакции всех портфелей (только ADMIN)' })
  @ApiResponse({ status: 200, description: 'Список всех транзакций' })
  getAll() {
    return this.transactions.getAllTransactions();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить все транзакции своего портфеля по ID' })
  @ApiParam({ name: 'id', description: 'ID портфеля', example: 1 })
  @ApiResponse({ status: 200, description: 'Список транзакций для указанного портфеля' })
  @ApiResponse({ status: 403, description: 'Чужой портфель' })
  getAllPortfolioTransactions(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
  ) {
    // Передаём userId — раньше любой залогиненный мог прочитать
    // транзакции чужого портфеля.
    return this.transactions.getAllPortfolioTransactions(Number(id), userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Удалить свою транзакцию по ID' })
  @ApiParam({ name: 'id', description: 'ID транзакции', example: 3 })
  @ApiResponse({ status: 200, description: 'Транзакция удалена, связанные данные обновлены' })
  @ApiResponse({ status: 403, description: 'Чужая транзакция' })
  @ApiResponse({ status: 404, description: 'Транзакция не найдена' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.transactions.deleteTransaction(Number(id), userId);
  }
}

import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PortfoliosService } from './portfolios.service';
import { CreatePortfolioDto } from '@libs/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';

@ApiTags('Портфели')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Создание нового портфеля' })
  @ApiBody({ type: CreatePortfolioDto })
  @ApiResponse({ status: 201, description: 'Портфель успешно создан' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации входных данных' })
  create(@Body() dto: CreatePortfolioDto) {
    return this.portfolios.createPortfolio(dto);
  }

  @Get('/user/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить все портфели пользователя по его ID' })
  @ApiParam({ name: 'id', example: 1, description: 'ID пользователя' })
  @ApiResponse({ status: 200, description: 'Список портфелей' })
  getAll(@Param('id') id: string) {
    return this.portfolios.getAllPortfolios(Number(id));
  }

  @Get('/name/:name')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить портфель по названию' })
  @ApiParam({ name: 'name', example: 'Crypto Portfolio', description: 'Название портфеля' })
  @ApiResponse({ status: 200, description: 'Портфель найден или сообщение об отсутствии' })
  getByName(@Param('name') name: string) {
    return this.portfolios.getPortfolioByName(name);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Удалить портфель по ID' })
  @ApiParam({ name: 'id', example: 5, description: 'ID портфеля' })
  @ApiResponse({ status: 200, description: 'Портфель успешно удалён' })
  @ApiResponse({ status: 404, description: 'Портфель не найден' })
  delete(@Param('id') id: string) {
    return this.portfolios.deletePortfolio(Number(id));
  }
}

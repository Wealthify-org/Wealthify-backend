import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { PortfoliosService } from './portfolios.service';

@Controller('portfolios')
export class PortfoliosController {
  constructor(private portfolioService: PortfoliosService) {}

  @Post()
  create(@Body() dto: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(dto)
  }

  @Get('/user/:id')
  getAll(@Param('id') id: string) {
    return this.portfolioService.getAllPortfolios(Number(id))
  }

  @Get('/name/:name')
  getByName(@Param('name') name: string) {
    return this.portfolioService.getPortfolioByName(name)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.portfolioService.deletePortfolio(Number(id))
  }
}

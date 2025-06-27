import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { where } from 'sequelize';

@Injectable()
export class PortfoliosService {
  constructor(@InjectModel(Portfolio) private portfolioRepository: typeof Portfolio) {}

  async createPortfolio(dto: CreatePortfolioDto) {
    const portfolio = await this.portfolioRepository.create(dto)
    return portfolio
  }

  async getPortfolioByName(name: string) {
    const portfolio = await this.portfolioRepository.findOne({where: {name}, include: {all: true, nested: true}, nest: true})
    return portfolio
  }
}

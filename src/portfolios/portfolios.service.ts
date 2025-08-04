import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { PortfolioAssets } from 'src/assets/portfolio-assets.model';
import { Transaction } from 'src/transactions/transactions.model';

@Injectable()
export class PortfoliosService {
  constructor(@InjectModel(Portfolio) private portfolioRepository: typeof Portfolio,
              @InjectModel(PortfolioAssets) private portfolioAssetsRepository: typeof PortfolioAssets,
              @InjectModel(Transaction) private transactionRepository: typeof Transaction
            ) {}

  async createPortfolio(dto: CreatePortfolioDto) {
    const portfolio = await this.portfolioRepository.create(dto)
    return portfolio
  }

  async getAllPortfolios(id: number) {
    const portfolios = await this.portfolioRepository.findAll({where: {userId: id}, include: {all: true}})
    return portfolios
  }

  async getPortfolioByName(name: string) {
    const portfolio = await this.portfolioRepository.findOne({where: {name}, include: {all: true, nested: true}, nest: true})
    if (!portfolio) {
      return { message: `Portfolio with such name ${name} doesn\'t exist`}
    }
    return portfolio
  }

  async deletePortfolio(id: number) {
    const portfolio = await this.portfolioRepository.findByPk(id)

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${id} not found`)
    }

    await this.transactionRepository.destroy({where: {portfolioId: id}})

    await this.portfolioAssetsRepository.destroy({where: {portfolioId: id}})

    await this.portfolioRepository.destroy({where: {id}})

    return { message: `Portfolio ${id} was successfully deleted`}
  }
}

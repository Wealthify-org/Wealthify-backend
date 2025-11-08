import { HttpStatus, Injectable} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Portfolio } from './portfolios.model';
import { CreatePortfolioDto } from  '@libs/contracts';
import { PortfolioAssets } from '@app/assets/portfolio-assets.model';
import { Transaction } from '@app/transactions/transactions.model';
import { rpcError } from '@libs/contracts/common';

@Injectable()
export class PortfoliosService {
  constructor(@InjectModel(Portfolio) private portfolioRepository: typeof Portfolio,
              @InjectModel(PortfolioAssets) private portfolioAssetsRepository: typeof PortfolioAssets,
              @InjectModel(Transaction) private transactionRepository: typeof Transaction
            ) {}

  async createPortfolio(dto: CreatePortfolioDto) {
    const exists = await this.portfolioRepository.findOne({ where: { userId: dto.userId, name: dto.name }});
    if (exists) rpcError(HttpStatus.CONFLICT, 'PORTFOLIO_EXISTS', `Portfolio "${dto.name}" already exists`);
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
      rpcError(
        HttpStatus.NOT_FOUND,
        'PORTFOLIO_NOT_FOUND',
        `Portfolio with name "${name}" doesn't exist`,
      );
    }
    return portfolio
  }

  async deletePortfolio(id: number) {
    const portfolio = await this.portfolioRepository.findByPk(id)

    if (!portfolio) {
      rpcError(HttpStatus.NOT_FOUND, 'PORTFOLIO_NOT_FOUND', `Portfolio ${id} not found`);
    }

    await this.transactionRepository.destroy({where: {portfolioId: id}})

    await this.portfolioAssetsRepository.destroy({where: {portfolioId: id}})

    await this.portfolioRepository.destroy({where: {id}})

    return { message: `Portfolio ${id} was successfully deleted`}
  }
}

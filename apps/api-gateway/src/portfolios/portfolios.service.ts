import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { APP_CLIENT } from "./constant";
import { PORTFOLIOS_PATTERNS } from '@app/contracts/portfolios/portfolios.pattern';
import { CreatePortfolioDto } from '@app/contracts';

@Injectable()
export class PortfoliosService {
  constructor(@Inject(APP_CLIENT) private readonly appMs: ClientProxy) {}

  createPortfolio(dto: CreatePortfolioDto) {
    return firstValueFrom(
      this.appMs.send(
        PORTFOLIOS_PATTERNS.CREATE, 
        dto
      )
    );
  }

  getAllPortfolios(userId: number) {
    return firstValueFrom(
      this.appMs.send(
        PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER, 
        { userId }
      ),
    );
  }

  getPortfolioByName(name: string) {
    return firstValueFrom(
      this.appMs.send(
        PORTFOLIOS_PATTERNS.FIND_BY_NAME, 
        { name }
      ),
    );
  }

  deletePortfolio(id: number) {
    return firstValueFrom(
      this.appMs.send(
        PORTFOLIOS_PATTERNS.DELETE_BY_ID, 
        { id }
      ),
    );
  }
}

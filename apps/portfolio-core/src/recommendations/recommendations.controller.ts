import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";

import { RECOMMENDATIONS_PATTERNS } from "@libs/contracts";
import { RecommendationsService } from "./recommendations.service";

@Controller()
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}

  @MessagePattern(RECOMMENDATIONS_PATTERNS.GENERATE_FOR_PORTFOLIO)
  generate(@Payload() payload: { portfolioId: number; userId: number }) {
    return this.service.generateForPortfolio(payload.portfolioId, payload.userId);
  }
}

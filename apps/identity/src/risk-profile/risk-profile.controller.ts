import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { RiskProfileService } from "./risk-profile.service";
import { RISK_PROFILE_PATTERNS } from "@libs/contracts";

@Controller()
export class RiskProfileController {
  constructor(private readonly service: RiskProfileService) {}

  @MessagePattern(RISK_PROFILE_PATTERNS.GET_QUESTIONS)
  getQuestions() {
    return this.service.getQuestions();
  }

  @MessagePattern(RISK_PROFILE_PATTERNS.GET_BY_USER)
  getByUser(@Payload() payload: { userId: number }) {
    return this.service.getByUser(payload.userId);
  }

  @MessagePattern(RISK_PROFILE_PATTERNS.SUBMIT)
  submit(
    @Payload()
    payload: {
      userId: number;
      answers: Array<{ questionId: string; optionId: string }>;
    },
  ) {
    return this.service.submit(payload.userId, payload.answers);
  }
}

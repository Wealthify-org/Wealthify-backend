import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { sendOrThrow } from "@libs/contracts/common/rpc/client";
import {
  RISK_PROFILE_PATTERNS,
  SubmitRiskAnswersDto,
} from "@libs/contracts";
import { IDENTITY_CLIENT } from "./constant";

@Injectable()
export class RiskProfileService {
  constructor(
    @Inject(IDENTITY_CLIENT) private readonly identityMs: ClientProxy,
  ) {}

  getQuestions() {
    return sendOrThrow(this.identityMs, RISK_PROFILE_PATTERNS.GET_QUESTIONS, {});
  }

  getByUser(userId: number) {
    return sendOrThrow(this.identityMs, RISK_PROFILE_PATTERNS.GET_BY_USER, {
      userId,
    });
  }

  submit(userId: number, dto: SubmitRiskAnswersDto) {
    return sendOrThrow(this.identityMs, RISK_PROFILE_PATTERNS.SUBMIT, {
      userId,
      answers: dto.answers,
    });
  }
}

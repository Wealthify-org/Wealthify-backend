import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { RiskProfileService } from "./risk-profile.service";
import { SubmitRiskAnswersDto } from "@libs/contracts";

import { JwtAuthGuard } from "@gateway/common/guards/jwt-auth.guard";
import { CurrentUser } from "@gateway/common/decorators/сurrent-user.decorator";

@ApiTags("Риск-профиль")
@Controller("risk-profile")
export class RiskProfileController {
  constructor(private readonly service: RiskProfileService) {}

  @Get("questions")
  @ApiOperation({
    summary: "Получить список вопросов теста риск-профиля",
    description:
      "Публичный эндпоинт. Возвращает список вопросов и вариантов ответа без раскрытия весов.",
  })
  @ApiResponse({ status: 200, description: "Список вопросов" })
  getQuestions() {
    return this.service.getQuestions();
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Текущий риск-профиль пользователя",
    description:
      "Возвращает сохранённый риск-профиль текущего пользователя или null, если тест ещё не пройден.",
  })
  @ApiResponse({ status: 200, description: "Риск-профиль или null" })
  getMyProfile(@CurrentUser("id") userId: number) {
    return this.service.getByUser(userId);
  }

  @Post("submit")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Отправить ответы на вопросы теста",
    description:
      "Принимает массив ответов { questionId, optionId }. Должны быть ответы на все 10 вопросов. Возвращает рассчитанный риск-профиль и сохраняет его (с upsert по userId).",
  })
  @ApiBody({ type: SubmitRiskAnswersDto })
  @ApiResponse({ status: 200, description: "Профиль рассчитан и сохранён" })
  @ApiResponse({ status: 400, description: "Неполные или некорректные ответы" })
  submit(
    @CurrentUser("id") userId: number,
    @Body() dto: SubmitRiskAnswersDto,
  ) {
    return this.service.submit(userId, dto);
  }
}

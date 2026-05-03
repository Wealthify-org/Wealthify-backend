import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { RiskProfile } from "./risk-profile.model";
import {
  RISK_QUESTIONS,
  QUESTION_BY_ID,
  RiskQuestion,
} from "./questions.config";
import {
  bucketFromScore,
  RISK_BUCKET_DESCRIPTORS,
  RiskBucket,
} from "@libs/contracts";
import { rpcError } from "@libs/contracts/common";

interface SubmittedAnswer {
  questionId: string;
  optionId: string;
}

@Injectable()
export class RiskProfileService {
  constructor(
    @InjectModel(RiskProfile)
    private readonly riskProfileRepository: typeof RiskProfile,
  ) {}

  /**
   * Возвращает каталог вопросов без раскрытия весов клиенту
   * (чтобы человек не подбирал ответы под желаемый бакет).
   */
  getQuestions() {
    return RISK_QUESTIONS.map((q) => ({
      id: q.id,
      order: q.order,
      category: q.category,
      text: q.text,
      hint: q.hint,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    }));
  }

  /**
   * Получить риск-профиль пользователя. Если ещё не проходил — null.
   */
  async getByUser(userId: number) {
    const profile = await this.riskProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) return null;

    const descriptor = RISK_BUCKET_DESCRIPTORS[profile.bucket];

    return {
      id: profile.id,
      userId: profile.userId,
      score: profile.score,
      bucket: profile.bucket,
      bucketTitle: descriptor.title,
      bucketDescription: descriptor.shortDescription,
      targetAllocation: descriptor.targetAllocation,
      acceptableDrawdownPct: descriptor.acceptableDrawdownPct,
      answers: profile.answers,
      completedAt: profile.createdAt,
    };
  }

  /**
   * Принять ответы пользователя, посчитать score, сохранить (upsert) и вернуть профиль.
   */
  async submit(userId: number, answers: SubmittedAnswer[]) {
    if (!Array.isArray(answers) || answers.length === 0) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "RISK_PROFILE_NO_ANSWERS",
        "Answers array is empty",
      );
    }

    // Валидация ответов: каждый questionId должен существовать,
    // и каждый optionId должен быть валидным вариантом для своего вопроса.
    const validatedAnswers: Array<{
      questionId: string;
      optionId: string;
      weight: number;
    }> = [];

    const questionsAnswered = new Set<string>();

    for (const a of answers) {
      const question = QUESTION_BY_ID.get(a.questionId);
      if (!question) {
        rpcError(
          HttpStatus.BAD_REQUEST,
          "RISK_PROFILE_UNKNOWN_QUESTION",
          `Unknown question id: ${a.questionId}`,
        );
      }
      if (questionsAnswered.has(a.questionId)) {
        rpcError(
          HttpStatus.BAD_REQUEST,
          "RISK_PROFILE_DUPLICATE_ANSWER",
          `Duplicate answer for question: ${a.questionId}`,
        );
      }

      const opt = (question as RiskQuestion).options.find(
        (o) => o.id === a.optionId,
      );
      if (!opt) {
        rpcError(
          HttpStatus.BAD_REQUEST,
          "RISK_PROFILE_UNKNOWN_OPTION",
          `Unknown option ${a.optionId} for question ${a.questionId}`,
        );
      }

      questionsAnswered.add(a.questionId);
      validatedAnswers.push({
        questionId: a.questionId,
        optionId: a.optionId,
        weight: opt!.weight,
      });
    }

    // Требуем ответы на ВСЕ вопросы — иначе скор будет смещён.
    if (questionsAnswered.size !== RISK_QUESTIONS.length) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "RISK_PROFILE_INCOMPLETE",
        `Must answer all ${RISK_QUESTIONS.length} questions, got ${questionsAnswered.size}`,
      );
    }

    const totalWeight = validatedAnswers.reduce((sum, a) => sum + a.weight, 0);
    const score = totalWeight / validatedAnswers.length;
    const bucket: RiskBucket = bucketFromScore(score);

    // Upsert: один профиль на пользователя — перезаписываем при повторном прохождении.
    const existing = await this.riskProfileRepository.findOne({
      where: { userId },
    });

    let profile: RiskProfile;
    if (existing) {
      existing.score = score;
      existing.bucket = bucket;
      existing.answers = validatedAnswers;
      profile = await existing.save();
    } else {
      profile = await this.riskProfileRepository.create({
        userId,
        score,
        bucket,
        answers: validatedAnswers,
      });
    }

    const descriptor = RISK_BUCKET_DESCRIPTORS[bucket];

    return {
      id: profile.id,
      userId: profile.userId,
      score: profile.score,
      bucket: profile.bucket,
      bucketTitle: descriptor.title,
      bucketDescription: descriptor.shortDescription,
      targetAllocation: descriptor.targetAllocation,
      acceptableDrawdownPct: descriptor.acceptableDrawdownPct,
      answers: profile.answers,
      completedAt: profile.createdAt,
    };
  }
}

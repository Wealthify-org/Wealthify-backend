/**
 * Уровень рекомендации:
 *  - warning  — есть существенный риск, требует внимания
 *  - info     — наблюдение / drift, стоит подумать
 *  - positive — портфель в хорошем состоянии по этой метрике
 */
export type RecommendationLevel = "warning" | "info" | "positive";

export interface RecommendationDto {
  /** Уровень / тон. */
  level: RecommendationLevel;
  /** Короткий заголовок (5–10 слов). */
  title: string;
  /** Развёрнутое описание (1–3 предложения). */
  description: string;
  /** Опциональное конкретное действие («Увеличьте долю BTC до 30%»). */
  action?: string;
}

export type RecommendationsSourceMode = "llm" | "rules-fallback";

export interface RecommendationsResultDto {
  portfolioId: number;
  /** Бакет риск-профиля пользователя или null если ещё не пройден. */
  riskBucket: string | null;
  /** Какой источник сгенерировал — LLM или rule-based fallback. */
  source: RecommendationsSourceMode;
  recommendations: RecommendationDto[];
  /** Когда сгенерировано — ISO. */
  generatedAt: string;
}

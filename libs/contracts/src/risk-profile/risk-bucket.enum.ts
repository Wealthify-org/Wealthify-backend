export enum RiskBucket {
  CONSERVATIVE = "Conservative",
  MODERATE = "Moderate",
  AGGRESSIVE = "Aggressive",
  SPECULATIVE = "Speculative",
}

/**
 * Перевод итогового score (1.0 – 10.0) в бакет.
 * Границы выбраны так, чтобы случайный набор средних ответов попадал
 * в Moderate, а явно осторожные / явно агрессивные — в Conservative / Speculative.
 */
export function bucketFromScore(score: number): RiskBucket {
  if (score <= 3.5) return RiskBucket.CONSERVATIVE;
  if (score <= 5.5) return RiskBucket.MODERATE;
  if (score <= 7.5) return RiskBucket.AGGRESSIVE;
  return RiskBucket.SPECULATIVE;
}

export interface RiskBucketDescriptor {
  bucket: RiskBucket;
  title: string;
  shortDescription: string;
  /** Целевая структура портфеля для recommendations engine. Сумма = 100. */
  targetAllocation: {
    stables: number;
    btc: number;
    eth: number;
    largeAlts: number;
    smallAlts: number;
  };
  /** Допустимая просадка, на которую профиль психологически готов. */
  acceptableDrawdownPct: number;
}

export const RISK_BUCKET_DESCRIPTORS: Record<RiskBucket, RiskBucketDescriptor> = {
  [RiskBucket.CONSERVATIVE]: {
    bucket: RiskBucket.CONSERVATIVE,
    title: "Консервативный",
    shortDescription:
      "Вам важно сохранить капитал. Большая часть портфеля — стейблкоины и крупнейшие криптовалюты с минимальной волатильностью.",
    targetAllocation: { stables: 50, btc: 30, eth: 15, largeAlts: 5, smallAlts: 0 },
    acceptableDrawdownPct: 10,
  },
  [RiskBucket.MODERATE]: {
    bucket: RiskBucket.MODERATE,
    title: "Умеренный",
    shortDescription:
      "Баланс между ростом и стабильностью. Основа — BTC и ETH с небольшой долей крупных альткоинов и стейблов.",
    targetAllocation: { stables: 20, btc: 40, eth: 25, largeAlts: 15, smallAlts: 0 },
    acceptableDrawdownPct: 25,
  },
  [RiskBucket.AGGRESSIVE]: {
    bucket: RiskBucket.AGGRESSIVE,
    title: "Агрессивный",
    shortDescription:
      "Готовы к высокой волатильности ради потенциально высокой доходности. Диверсифицированный портфель с долей средне- и низкокапитализированных альткоинов.",
    targetAllocation: { stables: 10, btc: 30, eth: 25, largeAlts: 25, smallAlts: 10 },
    acceptableDrawdownPct: 45,
  },
  [RiskBucket.SPECULATIVE]: {
    bucket: RiskBucket.SPECULATIVE,
    title: "Спекулятивный",
    shortDescription:
      "Высокий риск ради максимальной потенциальной прибыли. Большая доля среднекапитализированных и небольших альткоинов, готовы к экстремальной волатильности.",
    targetAllocation: { stables: 5, btc: 20, eth: 20, largeAlts: 30, smallAlts: 25 },
    acceptableDrawdownPct: 70,
  },
};

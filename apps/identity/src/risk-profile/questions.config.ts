/**
 * Тест риск-профиля по методологии financial-industry questionnaires
 * (упрощённая версия CFA Investment Policy Statement).
 *
 * 10 вопросов из 5 категорий (по 2 вопроса каждая):
 *   1. Investment horizon — горизонт инвестирования
 *   2. Capacity — финансовая способность принимать риск
 *   3. Tolerance — психологическая толерантность к просадкам
 *   4. Knowledge / experience — опыт и понимание рынка
 *   5. Goals — цели и характер инвестиций
 *
 * Score: каждый ответ имеет вес 1–10, итоговый score = sum / N.
 * Финальный балл от 1 до 10 переводится в 4 бакета:
 *   Conservative   — 1.0 – 3.5
 *   Moderate       — 3.6 – 5.5
 *   Aggressive     — 5.6 – 7.5
 *   Speculative    — 7.6 – 10.0
 */

export type RiskQuestionCategory =
  | "horizon"
  | "capacity"
  | "tolerance"
  | "knowledge"
  | "goals";

export interface RiskQuestionOption {
  /** Стабильный идентификатор варианта (для хранения ответов и аналитики). */
  id: string;
  text: string;
  /** Балл этого варианта в шкале 1–10. */
  weight: number;
}

export interface RiskQuestion {
  id: string;
  order: number;
  category: RiskQuestionCategory;
  text: string;
  /** Подсказка, которая помогает понять контекст вопроса (опционально). */
  hint?: string;
  options: RiskQuestionOption[];
}

export const RISK_QUESTIONS: ReadonlyArray<RiskQuestion> = [
  // ── HORIZON ────────────────────────────────────────────────────────────
  {
    id: "q1_horizon_when_need_money",
    order: 1,
    category: "horizon",
    text: "Через сколько времени вам понадобятся вложенные в крипто средства?",
    hint: "Чем дольше горизонт, тем больше времени у портфеля на восстановление после просадок.",
    options: [
      { id: "soon", text: "Меньше года", weight: 1 },
      { id: "1_3y", text: "От 1 до 3 лет", weight: 4 },
      { id: "3_5y", text: "От 3 до 5 лет", weight: 6 },
      { id: "5_10y", text: "От 5 до 10 лет", weight: 9 },
      { id: "10y_plus", text: "Более 10 лет / без чёткого срока", weight: 10 },
    ],
  },
  {
    id: "q2_horizon_age",
    order: 2,
    category: "horizon",
    text: "К какой возрастной группе вы относитесь?",
    hint: "Возраст напрямую влияет на инвестиционный горизонт и способность пережидать просадки.",
    options: [
      { id: "55_plus", text: "Старше 55 лет", weight: 2 },
      { id: "46_55", text: "46–55 лет", weight: 4 },
      { id: "36_45", text: "36–45 лет", weight: 6 },
      { id: "26_35", text: "26–35 лет", weight: 8 },
      { id: "18_25", text: "18–25 лет", weight: 10 },
    ],
  },

  // ── CAPACITY (финансовая способность) ──────────────────────────────────
  {
    id: "q3_capacity_share_of_savings",
    order: 3,
    category: "capacity",
    text: "Какую долю от ваших общих сбережений составляет крипто-портфель?",
    hint: "Чем меньше доля, тем спокойнее можно относиться к её волатильности.",
    options: [
      { id: "over_50", text: "Более 50%", weight: 2 },
      { id: "31_50", text: "31–50%", weight: 4 },
      { id: "16_30", text: "16–30%", weight: 6 },
      { id: "5_15", text: "5–15%", weight: 8 },
      { id: "lt_5", text: "Менее 5%", weight: 10 },
    ],
  },
  {
    id: "q4_capacity_income_stability",
    order: 4,
    category: "capacity",
    text: "Насколько стабилен ваш доход и подушка безопасности?",
    hint: "Подушка безопасности — это сумма, на которую вы можете прожить без основного дохода.",
    options: [
      {
        id: "no_income",
        text: "Стабильного дохода нет, подушки нет",
        weight: 2,
      },
      {
        id: "irregular",
        text: "Доход нерегулярный (студент, фриланс, подработки)",
        weight: 4,
      },
      {
        id: "stable_no_cushion",
        text: "Стабильный доход, но без подушки безопасности",
        weight: 5,
      },
      {
        id: "stable_3_6m",
        text: "Стабильный доход + подушка на 3–6 месяцев",
        weight: 8,
      },
      {
        id: "diversified",
        text: "Несколько источников дохода + значительная подушка",
        weight: 10,
      },
    ],
  },

  // ── TOLERANCE (психологическая) ─────────────────────────────────────────
  {
    id: "q5_tolerance_drop_30_reaction",
    order: 5,
    category: "tolerance",
    text:
      "Представьте: ваш портфель за неделю упал на 30%. Что вы сделаете?",
    hint: "Этот вопрос отражает вашу реальную психологическую толерантность к рыночным шокам.",
    options: [
      { id: "panic_sell_all", text: "Продам всё, чтобы спасти оставшееся", weight: 1 },
      { id: "sell_half", text: "Продам половину, чтобы снизить риск", weight: 3 },
      { id: "hold", text: "Ничего не продам, подожду восстановления", weight: 6 },
      { id: "buy_more_small", text: "Докуплю немного на просадке", weight: 9 },
      { id: "buy_more_aggressive", text: "Активно докуплю — вижу возможность", weight: 10 },
    ],
  },
  {
    id: "q6_tolerance_max_acceptable_drawdown",
    order: 6,
    category: "tolerance",
    text:
      "Какую максимальную просадку портфеля вы готовы выдержать без серьёзного дискомфорта?",
    hint:
      "Просадка — это снижение стоимости портфеля от пика до текущего значения. В крипте это норма.",
    options: [
      { id: "5pct", text: "До 5%", weight: 1 },
      { id: "15pct", text: "До 15%", weight: 3 },
      { id: "30pct", text: "До 30%", weight: 5 },
      { id: "50pct", text: "До 50%", weight: 8 },
      { id: "over_50pct", text: "Более 50% — готов к экстремальной волатильности", weight: 10 },
    ],
  },

  // ── KNOWLEDGE & EXPERIENCE ──────────────────────────────────────────────
  {
    id: "q7_knowledge_general_investing",
    order: 7,
    category: "knowledge",
    text: "Какой у вас общий опыт инвестирования (включая акции, облигации, фонды)?",
    options: [
      { id: "none", text: "Никогда не инвестировал", weight: 2 },
      { id: "deposits_only", text: "Только банковские депозиты", weight: 4 },
      { id: "etf_stocks", text: "Покупал акции и/или ETF на бирже", weight: 6 },
      {
        id: "active_diversified",
        text: "Активно управляю портфелем из нескольких классов активов",
        weight: 8,
      },
      { id: "professional", text: "Профессиональный трейдер или инвестор", weight: 10 },
    ],
  },
  {
    id: "q8_knowledge_crypto_specific",
    order: 8,
    category: "knowledge",
    text: "Насколько хорошо вы разбираетесь в криптовалютах конкретно?",
    options: [
      { id: "newbie", text: "Только слышал, не разбираюсь", weight: 2 },
      { id: "casual_btc_eth", text: "Покупал BTC/ETH несколько раз", weight: 4 },
      {
        id: "regular",
        text: "Регулярно слежу за рынком, держу портфель из нескольких монет",
        weight: 6,
      },
      {
        id: "advanced",
        text: "Понимаю DeFi, L2, стейкинг; активно торгую",
        weight: 8,
      },
      {
        id: "pro_crypto",
        text: "Опытный криптотрейдер, читаю токеномику и ончейн-данные",
        weight: 10,
      },
    ],
  },

  // ── GOALS ──────────────────────────────────────────────────────────────
  {
    id: "q9_goals_primary_objective",
    order: 9,
    category: "goals",
    text: "Какова ваша главная цель в этом крипто-портфеле?",
    options: [
      {
        id: "preserve",
        text: "Сохранить капитал от инфляции",
        weight: 2,
      },
      {
        id: "passive_income",
        text: "Получать стабильный пассивный доход",
        weight: 4,
      },
      {
        id: "balanced_growth",
        text: "Сбалансированный рост + умеренный риск",
        weight: 6,
      },
      {
        id: "long_term_wealth",
        text: "Долгосрочное приумножение капитала",
        weight: 8,
      },
      {
        id: "speculation",
        text: "Спекулятивная торговля ради максимальной прибыли",
        weight: 10,
      },
    ],
  },
  {
    id: "q10_goals_return_vs_safety",
    order: 10,
    category: "goals",
    text: "Что важнее для вас в инвестициях?",
    hint:
      "Это вопрос о философии: предпочитаете ли вы предсказуемость или потенциал высокой доходности.",
    options: [
      {
        id: "safety_only",
        text: "Сохранить капитал любой ценой, даже без прибыли",
        weight: 1,
      },
      {
        id: "stable_small",
        text: "Стабильный небольшой доход (5–10% годовых)",
        weight: 4,
      },
      {
        id: "balance",
        text: "Баланс между ростом и стабильностью (10–25% годовых)",
        weight: 6,
      },
      {
        id: "high_growth",
        text: "Высокий рост, готов к колебаниям (25–50%+ годовых)",
        weight: 9,
      },
      {
        id: "max_alpha",
        text: "Максимальная доходность, даже с риском больших потерь",
        weight: 10,
      },
    ],
  },
];

/**
 * Быстрый lookup по id вопроса/варианта — для валидации ответов
 * и расчёта итогового score.
 */
export const QUESTION_BY_ID = new Map(RISK_QUESTIONS.map((q) => [q.id, q]));

export function getOptionWeight(
  questionId: string,
  optionId: string,
): number | null {
  const q = QUESTION_BY_ID.get(questionId);
  if (!q) return null;
  const opt = q.options.find((o) => o.id === optionId);
  return opt ? opt.weight : null;
}

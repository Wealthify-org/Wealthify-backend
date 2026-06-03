import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom, timeout } from "rxjs";

import {
  OpenRouterJsonSchema,
  OpenRouterService,
} from "@libs/openrouter";
import {
  RECOMMENDATIONS_PATTERNS,
  RecommendationDto,
  RecommendationsResultDto,
  RISK_PROFILE_PATTERNS,
} from "@libs/contracts";

import { PortfoliosService } from "../portfolios/portfolios.service";
import {
  buildObservations,
  observationsToRecommendations,
  PortfolioSnapshot,
  RiskProfileSnapshot,
} from "./observations";
import { IDENTITY_CLIENT } from "./constants";

type Lang = "ru" | "en";

interface LlmRecommendationsPayload {
  recommendations: RecommendationDto[];
}

const SCHEMA_DESCRIPTIONS: Record<
  Lang,
  {
    level: string;
    title: string;
    description: string;
    action: string;
  }
> = {
  ru: {
    level:
      "Уровень: warning — только для серьёзных системных рисков (≥80% капитала в одном активе, полное отсутствие стейблов у консервативного профиля). info — обычное наблюдение или мягкая идея для размышления (используй по умолчанию). positive — портфель близок к целевой структуре.",
    title:
      "Описательный заголовок 5–9 слов, без алармистских эпитетов (никаких «критическая», «срочно»). Без точки на конце. Без markdown. Пример: «Высокая доля BTC в портфеле», а не «Критическая концентрация капитала в одном активе».",
    description:
      "1–3 предложения, мягким тоном наблюдения, не приговора. Сначала описывай факт, потом — что это может значить. Используй «можно подумать о», «стоит обратить внимание», «было бы полезно», а не «это противоречит» / «критически важно». Допустим markdown: **жирный** для ключевых терминов и `инлайн-код` для тикеров/метрик.",
    action:
      "Опциональная мягкая идея для размышления, не приказ. Используй формы: «Можно рассмотреть...», «Полезно было бы...», «Стоит подумать о...», «Один из вариантов — ...». Никаких «Приведите», «Выделите», «Сформируйте». Допустим markdown.",
  },
  en: {
    level:
      "Level: warning — only for serious systemic risks (≥80% of capital in a single asset, complete lack of stables for a conservative profile). info — a regular observation or a soft idea to consider (use this by default). positive — portfolio is close to the target structure.",
    title:
      "Descriptive title in 5–9 words, no alarmist adjectives (no 'critical', 'urgent'). No period at the end. No markdown. Example: 'High share of BTC in portfolio' — not 'Critical capital concentration in a single asset'.",
    description:
      "1–3 sentences, in a soft observational tone — not a verdict. State the fact first, then what it might mean. Prefer phrasings like 'you might want to look at', 'it could be worth considering', 'one thing to keep in mind' — avoid 'this violates', 'critically important'. Markdown allowed: **bold** for key terms and `inline code` for tickers/metrics.",
    action:
      "An optional soft suggestion to consider, not an order. Use forms like: 'You could consider...', 'It might be worth...', 'One option would be...', 'Worth thinking about...'. Avoid imperatives like 'Bring', 'Allocate', 'Set up'. Markdown allowed.",
  },
};

const buildLlmSchema = (lang: Lang): OpenRouterJsonSchema => ({
  name: "portfolio_recommendations",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["recommendations"],
    properties: {
      recommendations: {
        type: "array",
        minItems: 1,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["level", "title", "description"],
          properties: {
            level: {
              type: "string",
              enum: ["warning", "info", "positive"],
              description: SCHEMA_DESCRIPTIONS[lang].level,
            },
            title: {
              type: "string",
              description: SCHEMA_DESCRIPTIONS[lang].title,
            },
            description: {
              type: "string",
              description: SCHEMA_DESCRIPTIONS[lang].description,
            },
            action: {
              type: "string",
              description: SCHEMA_DESCRIPTIONS[lang].action,
            },
          },
        },
      },
    },
  },
});

/**
 * SYSTEM PROMPT построен по best-practice финансового advisor'а:
 *  - Чёткая роль («криптоаналитик-coach», не financial advisor — мы не лицензированы)
 *  - Образовательная рамка (это анализ структуры, не персональный financial advice)
 *  - Anti-hallucination: оперируй ТОЛЬКО данными из контекста
 *  - Явные refusal rules: никаких прогнозов цен, гарантий, торговых сигналов
 *  - Структурированный thinking pattern: assess → diagnose → propose
 *  - Чёткая шкала уровней с пороговыми правилами
 */
const SYSTEM_PROMPT_RU = `Ты — аналитик криптовалютных портфелей и помощник пользователя, помогающий ему \
лучше понимать структуру своего портфеля. Ты не лицензированный финансовый советник — \
твои рекомендации носят АНАЛИТИКО-ОБРАЗОВАТЕЛЬНЫЙ характер. Ты помогаешь УВИДЕТЬ нюансы \
и предлагаешь идеи для размышления, но НЕ даёшь индивидуальных торговых указаний \
и не давишь на пользователя.

# Кому ты помогаешь
Пользователю Wealthify — частному криптоинвестору. Он прошёл (или нет) тест риск-профиля; \
ты получаешь его ЦЕЛЕВУЮ АЛЛОКАЦИЮ как ориентир, к которому он МОЖЕТ стремиться.

# Что от тебя нужно
Сформируй 3–6 персональных мягких наблюдений и идей по структуре портфеля.
Каждая должна давать конкретную пользу — без воды, без banalité, но без давления и \
алармизма.

# Стиль мышления (применяй к каждой рекомендации)
1. ASSESS — что ты заметил в данных
2. CONTEXTUALIZE — почему это интересно учесть (без катастрофизма)
3. SUGGEST — мягкая идея для размышления, которую пользователь может рассмотреть

# Уровни (level) — раздавай ОЧЕНЬ экономно
- "warning" — ТОЛЬКО для системных рисков, где портфель действительно уязвим: \
≥80% капитала в одном активе, полное отсутствие стейблов у консервативного профиля. \
Это РЕДКИЙ уровень — большинство наблюдений должны быть "info", не "warning".
- "info" — ИСПОЛЬЗУЙ ПО УМОЛЧАНИЮ. Любое наблюдение, идея, мягкая мысль о \
ребалансировке, drift в 20–60 п.п., недостаточная диверсификация (3–4 актива), \
заметная доля мелких альтов — всё это "info".
- "positive" — портфель в хорошей форме по этой метрике (близок к целевой структуре).

Если сомневаешься между warning и info — выбирай info.

# Правила тона (КРИТИЧНО)
- НЕ используй слова: «критическая», «критически важно», «срочно», «обязательно \
нужно», «противоречит принципам», «нарушает», «недопустимо», «опасно».
- Заголовки — описательные, не алармистские: \
✓ «Высокая доля BTC в портфеле» \
✗ «Критическая концентрация капитала в одном активе» \
✓ «Нет стейблкоинов в портфеле» \
✗ «Отсутствие защитного слоя в стейблкоинах»
- Описание — мягкое, наблюдательное: \
✓ «Сейчас 100% портфеля приходится на BTC. Это означает, что динамика портфеля \
полностью повторяет движение одного актива.» \
✗ «100% портфеля сосредоточено в BTC, что создаёт риск полной зависимости...»
- Действие (action) — МЯГКАЯ ИДЕЯ, не приказ: \
✓ «Можно рассмотреть постепенное добавление ETH и крупных альтов до целевых уровней» \
✓ «Полезно было бы выделить часть капитала в стейблы — это даст запас на просадках» \
✗ «Приведите долю BTC к целевым 30%» \
✗ «Выделите 10% в стейблкоины»

# Правила фактов (тоже нельзя нарушать)
- Опирайся ТОЛЬКО на факты из данных, не выдумывай чисел и фактов.
- Не давай прогнозов цен, не используй фразы вида «будет расти», «обвалится», «купите по $X».
- Не упоминай конкретные ценовые таргеты как guaranteed.
- Не используй маркетинговый или хайп-тон («to the moon», «ракета», «бомба»).
- Пиши на русском, кратко и по делу.
- Заголовок: 5–9 слов, без точки на конце.
- Описание: 1–3 предложения, без воды.
- Если есть мягкая идея для размышления — добавь её в поле "action" (≤200 символов).
- Если у пользователя нет риск-профиля — мягко предложи пройти тест в одной из \
рекомендаций и объясни, чем это будет полезно.
- Не повторяй одну и ту же мысль в нескольких рекомендациях.

# Тон
Спокойный, доброжелательный, профессиональный. Как у грамотного аналитика, который \
делится наблюдениями и идеями, а не выписывает рецепты. Никакого давления.

# Язык
Все title/description/action — ТОЛЬКО на русском.`;

const SYSTEM_PROMPT_EN = `You are a crypto-portfolio analyst helping the user better UNDERSTAND the structure \
of their portfolio. You are NOT a licensed financial advisor — your recommendations are \
ANALYTICAL and EDUCATIONAL. You help the user SEE nuances and offer ideas worth considering, \
but you DO NOT issue trading instructions and never pressure the user.

# Who you help
A Wealthify user — a retail crypto investor. They have (or have not) taken the risk-profile test; \
you receive their TARGET ALLOCATION as a guideline they CAN aim for.

# What you must produce
3–6 personalized soft observations and ideas about the portfolio structure.
Each must give concrete value — no fluff, no banalities, no pressure or alarmism.

# Thinking pattern (apply to each recommendation)
1. ASSESS — what you noticed in the data
2. CONTEXTUALIZE — why it's interesting to keep in mind (without catastrophizing)
3. SUGGEST — a soft idea the user might consider

# Levels (level) — assign VERY sparingly
- "warning" — ONLY for systemic risks where the portfolio is genuinely fragile: \
≥80% of capital in a single asset, complete absence of stables for a conservative profile. \
This is a RARE level — most observations should be "info", not "warning".
- "info" — USE THIS BY DEFAULT. Any observation, idea, soft thought about rebalancing, \
drift of 20–60 pp, insufficient diversification (3–4 assets), notable small-alts share — \
all of these are "info".
- "positive" — portfolio is in good shape on this metric (close to target structure).

When in doubt between warning and info — pick info.

# Tone rules (CRITICAL)
- DO NOT use words like: "critical", "critically important", "urgent", "must", \
"violates principles", "breaches", "unacceptable", "dangerous".
- Titles — descriptive, not alarmist: \
✓ "High share of BTC in portfolio" \
✗ "Critical capital concentration in a single asset" \
✓ "No stablecoins in portfolio" \
✗ "Absence of a defensive stablecoin layer"
- Description — soft, observational: \
✓ "Right now 100% of the portfolio sits in BTC. That means the portfolio's performance \
fully tracks one asset's movement." \
✗ "100% of the portfolio is concentrated in BTC, which creates a risk of full dependence..."
- Action — A SOFT SUGGESTION, not an order: \
✓ "You could consider gradually adding ETH and large alts up to your target levels" \
✓ "It might be worth allocating part of the capital to stables for a buffer on drawdowns" \
✗ "Bring BTC down to the target 30%" \
✗ "Allocate 10% to stablecoins"

# Fact rules (also must not be broken)
- Rely ONLY on facts from the data, do not invent numbers or facts.
- Don't make price predictions, don't use phrases like "will go up", "will crash", "buy at $X".
- Don't mention specific price targets as guarantees.
- Don't use marketing or hype tone ("to the moon", "rocket", "gem").
- Write in English, briefly and to the point.
- Title: 5–9 words, no period at the end.
- Description: 1–3 sentences, no fluff.
- If there's a soft idea worth considering — put it in the "action" field (≤200 characters).
- If the user has no risk profile — gently suggest taking the test in one of the recommendations \
and explain how it would help.
- Don't repeat the same point in multiple recommendations.

# Tone
Calm, friendly, professional. Like a thoughtful analyst sharing observations and ideas, \
not someone writing prescriptions. No pressure.

# Language
All title/description/action — ENGLISH ONLY.`;

// ── STOCK-портфели: тот же мягкий аналитический тон, но про АКЦИИ ──────────
const SYSTEM_PROMPT_STOCK_RU = `Ты — аналитик портфелей акций и помощник пользователя, помогающий ему \
лучше понимать структуру своего портфеля российских акций. Ты не лицензированный \
финансовый советник — твои рекомендации носят АНАЛИТИКО-ОБРАЗОВАТЕЛЬНЫЙ характер. \
Ты помогаешь УВИДЕТЬ нюансы и предлагаешь идеи для размышления, но НЕ даёшь \
индивидуальных торговых указаний и не давишь на пользователя.

# Кому ты помогаешь
Пользователю Wealthify — частному инвестору в акции (биржа MOEX, котировки в рублях).

# Что от тебя нужно
Сформируй 3–6 персональных мягких наблюдений и идей по структуре портфеля акций.
Опирайся на: концентрацию в отдельных бумагах, отраслевую/секторальную диверсификацию \
(нефтегаз, банки, металлурги, IT, ритейл, энергетика и т.д.), размер позиций, \
доходность. Каждая мысль — конкретная и полезная, без воды и без алармизма.

# Стиль мышления (к каждой рекомендации)
1. ASSESS — что заметил в данных
2. CONTEXTUALIZE — почему это интересно учесть (без катастрофизма)
3. SUGGEST — мягкая идея для размышления

# Уровни (level) — раздавай ОЧЕНЬ экономно
- "warning" — ТОЛЬКО для системных рисков: ≥80% капитала в одной бумаге. Редкий уровень.
- "info" — ПО УМОЛЧАНИЮ. Концентрация 50–80%, мало бумаг (1–3), перекос в один сектор — всё это "info".
- "positive" — портфель хорошо диверсифицирован по бумагам и секторам.
Если сомневаешься между warning и info — выбирай info.

# Правила тона (КРИТИЧНО)
- НЕ используй слова: «критическая», «срочно», «обязательно», «нарушает», «опасно».
- Заголовки описательные: ✓ «Высокая доля Сбербанка в портфеле» ✗ «Критическая концентрация».
- Описание — мягкое, наблюдательное; сначала факт, потом что это может значить.
- Действие (action) — мягкая идея: «Можно рассмотреть...», «Полезно было бы...», не приказ.

# Правила фактов
- Опирайся ТОЛЬКО на данные из контекста, не выдумывай чисел.
- НЕ давай прогнозов цен, не используй «вырастет»/«обвалится»/«покупайте по X».
- НЕ используй крипто-понятия (стейблкоины, BTC, альткоины) — это портфель АКЦИЙ.
- Думай про отрасли, концентрацию по эмитентам и секторам, дивидендные истории (если уместно).
- Заголовок: 5–9 слов, без точки. Описание: 1–3 предложения. action ≤200 символов.
- Если у пользователя нет риск-профиля — мягко предложи пройти тест в одной из рекомендаций.

# Тон и язык
Спокойный, доброжелательный, профессиональный. Все title/description/action — ТОЛЬКО на русском.`;

const SYSTEM_PROMPT_STOCK_EN = `You are a stock-portfolio analyst helping the user better UNDERSTAND the structure of \
their Russian equities portfolio (MOEX exchange, prices in rubles). You are NOT a licensed \
financial advisor — your recommendations are ANALYTICAL and EDUCATIONAL. You help the user \
SEE nuances and offer ideas worth considering, but you DO NOT issue trading instructions \
and never pressure the user.

# What you must produce
3–6 personalized soft observations about the equities portfolio structure. Focus on: \
single-name concentration, sector diversification (oil & gas, banks, metals & mining, IT, \
retail, utilities, etc.), position sizing, returns. Each must be concrete and useful, no fluff, no alarmism.

# Thinking pattern (per recommendation): ASSESS → CONTEXTUALIZE → SUGGEST.

# Levels — assign VERY sparingly
- "warning" — ONLY systemic risk: ≥80% of capital in a single stock. Rare.
- "info" — DEFAULT. Concentration 50–80%, few names (1–3), single-sector tilt — all "info".
- "positive" — well diversified across names and sectors.
When in doubt — pick info.

# Tone rules (CRITICAL)
- DO NOT use: "critical", "urgent", "must", "violates", "dangerous".
- Titles descriptive: ✓ "High share of Sberbank in portfolio" ✗ "Critical concentration".
- Description — soft, observational: fact first, then what it might mean.
- Action — a soft suggestion ("You could consider...", "It might be worth..."), not an order.

# Fact rules
- Rely ONLY on context data, invent nothing.
- NO price predictions, no "will rise"/"will crash"/"buy at X".
- DO NOT use crypto concepts (stablecoins, BTC, altcoins) — this is an EQUITIES portfolio.
- Think in terms of sectors, issuer/sector concentration, dividends where relevant.
- Title: 5–9 words, no period. Description: 1–3 sentences. action ≤200 chars.
- If the user has no risk profile — gently suggest taking the test in one recommendation.

# Tone & language
Calm, friendly, professional. All title/description/action — ENGLISH ONLY.`;

const SYSTEM_PROMPT_CRYPTO: Record<Lang, string> = {
  ru: SYSTEM_PROMPT_RU,
  en: SYSTEM_PROMPT_EN,
};

const SYSTEM_PROMPT_STOCK: Record<Lang, string> = {
  ru: SYSTEM_PROMPT_STOCK_RU,
  en: SYSTEM_PROMPT_STOCK_EN,
};

const pickSystemPrompt = (lang: Lang, isStock: boolean): string =>
  isStock ? SYSTEM_PROMPT_STOCK[lang] : SYSTEM_PROMPT_CRYPTO[lang];

const isStockPortfolio = (type: string | undefined | null): boolean =>
  (type ?? "").toLowerCase().startsWith("stock");

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly portfoliosService: PortfoliosService,
    private readonly openRouter: OpenRouterService,
    @Inject(IDENTITY_CLIENT) private readonly identityMs: ClientProxy,
  ) {}

  /**
   * Главная точка входа — генерирует рекомендации для портфеля.
   */
  async generateForPortfolio(
    portfolioId: number,
    userId: number,
    lang: Lang = "ru",
  ): Promise<RecommendationsResultDto> {
    // 1) загрузим портфель и риск-профиль параллельно
    const [portfolioRaw, riskRaw] = await Promise.all([
      this.portfoliosService.getPortfolioDetailById(portfolioId, userId),
      this.fetchRiskProfile(userId),
    ]);

    const portfolio: PortfolioSnapshot = {
      id: portfolioRaw.id,
      name: portfolioRaw.name,
      type: portfolioRaw.type,
      totalValueUsd: portfolioRaw.totalValueUsd ?? 0,
      totalInvestedUsd: portfolioRaw.totalInvestedUsd ?? 0,
      totalProfitPct: portfolioRaw.totalProfitPct ?? 0,
      change24hPct: portfolioRaw.change24hPct ?? 0,
      assets: (portfolioRaw.assets ?? []).map((a: any) => ({
        ticker: a.ticker,
        name: a.name,
        type: a.type,
        quantity: a.quantity,
        averageBuyPrice: a.averageBuyPrice,
        currentPriceUsd: a.currentPriceUsd,
        valueUsd: a.valueUsd,
        investedUsd: a.investedUsd,
        profitUsd: a.profitUsd,
        profitPct: a.profitPct,
        change24HUsdPct: a.change24HUsdPct,
      })),
    };

    const risk: RiskProfileSnapshot | null = riskRaw
      ? {
          bucket: riskRaw.bucket,
          bucketTitle: riskRaw.bucketTitle,
          acceptableDrawdownPct: riskRaw.acceptableDrawdownPct,
          targetAllocation: riskRaw.targetAllocation,
        }
      : null;

    // 2) rule-based observations
    const { observations, actualAllocation } = buildObservations(portfolio, risk);

    // 3) попытаемся через LLM, fallback на правила
    let recommendations: RecommendationDto[];
    let source: RecommendationsResultDto["source"] = "llm";

    try {
      recommendations = await this.callLlm(portfolio, risk, actualAllocation, observations, lang);
      this.logger.log(
        `Recommendations generated via LLM for portfolio=${portfolioId} user=${userId} (${recommendations.length} items)`,
      );
    } catch (e) {
      this.logger.warn(
        `LLM recommendations failed for portfolio=${portfolioId}: ${(e as Error).message}. Falling back to rule-based.`,
      );
      recommendations = observationsToRecommendations(observations, risk);
      source = "rules-fallback";
    }

    return {
      portfolioId,
      riskBucket: risk?.bucket ?? null,
      source,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async fetchRiskProfile(userId: number): Promise<{
    bucket: RiskProfileSnapshot["bucket"];
    bucketTitle: string;
    acceptableDrawdownPct: number;
    targetAllocation: RiskProfileSnapshot["targetAllocation"];
  } | null> {
    try {
      // 5с timeout — без него висящий identity-MS блокирует генерацию
      // рекомендаций до 45с (gateway timeout) → user видит 504.
      const result = await lastValueFrom(
        this.identityMs
          .send(RISK_PROFILE_PATTERNS.GET_BY_USER, { userId })
          .pipe(timeout(5_000)),
      );
      // result null если пользователь ещё не проходил тест
      if (!result || !result.bucket) return null;
      return {
        bucket: result.bucket,
        bucketTitle: result.bucketTitle,
        acceptableDrawdownPct: result.acceptableDrawdownPct,
        targetAllocation: result.targetAllocation,
      };
    } catch (e) {
      this.logger.warn(
        `Failed to fetch risk-profile for user=${userId}: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async callLlm(
    portfolio: PortfolioSnapshot,
    risk: RiskProfileSnapshot | null,
    actualAllocation: ReturnType<typeof buildObservations>["actualAllocation"],
    observations: ReturnType<typeof buildObservations>["observations"],
    lang: Lang,
  ): Promise<RecommendationDto[]> {
    const userPrompt = this.buildUserPrompt(
      portfolio,
      risk,
      actualAllocation,
      observations,
      lang,
    );

    const { data } = await this.openRouter.chatStructured<LlmRecommendationsPayload>(
      buildLlmSchema(lang),
      {
        system: pickSystemPrompt(lang, isStockPortfolio(portfolio.type)),
        user: userPrompt,
        // низкая температура → стабильная структура и тон. Без seed —
        // раньше с фиксированным seed=42 пользователь жал "обновить" и
        // видел тот же текст 1:1 (выглядело как сломанный refresh). Кеш
        // OpenRouter всё равно срабатывает по идентичному body в течение
        // TTL, а после истечения — приходит свежий, чуть отличающийся ответ.
        temperature: 0.2,
        topP: 0.9,
        // 800 токенов более чем достаточно для 6 коротких пунктов
        maxTokens: 800,
        // OpenRouter response cache: если body identical (включая модель/опции),
        // следующий запрос в течение TTL — БЕСПЛАТНЫЙ
        cache: true,
        cacheTtlSeconds: 600, // 10 минут
        // OpenRouter routing: всегда выбираем самого дешёвого провайдера
        provider: { sort: "price", allow_fallbacks: true },
        label: `recommendations.portfolio_${portfolio.id}`,
      },
    );

    if (!data?.recommendations?.length) {
      throw new Error("LLM returned empty recommendations array");
    }

    // нормализация — обрезаем длинные строки и валидируем enum
    return data.recommendations.slice(0, 7).map((r) => ({
      level:
        r.level === "warning" || r.level === "info" || r.level === "positive"
          ? r.level
          : "info",
      title: (r.title ?? "").trim().slice(0, 120),
      description: (r.description ?? "").trim().slice(0, 600),
      action: r.action ? r.action.trim().slice(0, 300) : undefined,
    }));
  }

  private buildUserPrompt(
    portfolio: PortfolioSnapshot,
    risk: RiskProfileSnapshot | null,
    actual: ReturnType<typeof buildObservations>["actualAllocation"],
    observations: ReturnType<typeof buildObservations>["observations"],
    lang: Lang,
  ): string {
    /**
     * Все числа округлены ДО ЦЕЛЫХ для percent-полей и до 1 знака для денег
     * — это намеренно, чтобы мелкий drift цены (например, $9876.54 → $9876.78
     * через минуту) НЕ ломал OpenRouter response cache. Кеш хитится только
     * при идентичном body, поэтому стабильное представление даёт больший hit-rate.
     */
    const L = USER_PROMPT_LABELS[lang];
    const lines: string[] = [];
    const round0 = (v: number) => Math.round(v);
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const isStock = isStockPortfolio(portfolio.type);

    // ── портфель — компактно ─────────────────────────────────────────────
    lines.push(L.portfolioHeader);
    lines.push(
      `${L.value} $${round0(portfolio.totalValueUsd)} (${L.invested} $${round0(portfolio.totalInvestedUsd)}). ` +
        `${L.return} ${round1(portfolio.totalProfitPct)}%, ${L.h24} ${round1(portfolio.change24hPct)}%. ` +
        `${L.assets}: ${portfolio.assets.length}.`,
    );

    // ── активы — топ-10 в одну строку каждый ─────────────────────────────
    const top = [...portfolio.assets]
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, 10);
    if (top.length) {
      lines.push("");
      lines.push(L.topAssetsHeader);
      for (const a of top) {
        const sharePct = portfolio.totalValueUsd > 0
          ? (a.valueUsd / portfolio.totalValueUsd) * 100
          : 0;
        lines.push(
          `- ${a.ticker} | ${round0(sharePct)}% ${L.ofPortfolio} | total ${round0(a.profitPct)}% | ${L.h24} ${round0(a.change24HUsdPct)}%`,
        );
      }
    }

    // ── текущая категорийная аллокация (только для крипты) ────────────────
    if (!isStock) {
      lines.push("");
      lines.push(L.categoriesHeader);
      lines.push(
        `stables ${round0(actual.stables)} | BTC ${round0(actual.btc)} | ETH ${round0(actual.eth)} | largeAlts ${round0(actual.largeAlts)} | smallAlts ${round0(actual.smallAlts)}`,
      );
    }

    // ── риск-профиль ─────────────────────────────────────────────────────
    lines.push("");
    if (risk) {
      const t = risk.targetAllocation;
      lines.push(L.riskHeader);
      lines.push(
        `${risk.bucket} (${risk.bucketTitle}). ${L.acceptableDrawdown} ~${risk.acceptableDrawdownPct}%.`,
      );
      // крипто-целевую аллокацию для акций НЕ показываем (она про крипто-категории)
      if (!isStock) {
        lines.push(
          `${L.targetAllocation}: stables ${t.stables} | BTC ${t.btc} | ETH ${t.eth} | largeAlts ${t.largeAlts} | smallAlts ${t.smallAlts}`,
        );
      }
    } else {
      lines.push(L.riskHeader);
      lines.push(L.riskNotTaken);
    }

    // ── rule-based наблюдения как контекст ───────────────────────────────
    if (observations.length) {
      lines.push("");
      lines.push(L.observationsHeader);
      for (const o of observations) {
        lines.push(`- [s${o.severity}] ${o.fact}`);
      }
    }

    // ── финальная инструкция ─────────────────────────────────────────────
    lines.push("");
    lines.push(L.finalInstruction);

    return lines.join("\n");
  }
}

const USER_PROMPT_LABELS: Record<
  Lang,
  {
    portfolioHeader: string;
    value: string;
    invested: string;
    return: string;
    h24: string;
    assets: string;
    topAssetsHeader: string;
    ofPortfolio: string;
    categoriesHeader: string;
    riskHeader: string;
    acceptableDrawdown: string;
    targetAllocation: string;
    riskNotTaken: string;
    observationsHeader: string;
    finalInstruction: string;
  }
> = {
  ru: {
    portfolioHeader: "## Портфель",
    value: "Стоимость",
    invested: "вложено",
    return: "Доходность",
    h24: "24ч",
    assets: "Активов",
    topAssetsHeader: "## Активы (топ-10 по стоимости)",
    ofPortfolio: "портфеля",
    categoriesHeader: "## Категории (% от портфеля сейчас)",
    riskHeader: "## Риск-профиль пользователя",
    acceptableDrawdown: "Допустимая просадка",
    targetAllocation: "Целевая аллокация",
    riskNotTaken:
      "Тест не пройден. Обязательно одной из рекомендаций предложи пройти тест и объясни ценность.",
    observationsHeader:
      "## Что заметили правила (severity 1=критично, 3=наблюдение)",
    finalInstruction:
      "Сформируй 3–6 рекомендаций по схеме (level/title/description/action). " +
      "Покрой ВСЕ серьёзные наблюдения (severity 1–2) хотя бы одной рекомендацией. " +
      "Не повторяйся, пиши кратко и по делу.",
  },
  en: {
    portfolioHeader: "## Portfolio",
    value: "Value",
    invested: "invested",
    return: "Return",
    h24: "24h",
    assets: "Assets",
    topAssetsHeader: "## Assets (top-10 by value)",
    ofPortfolio: "of portfolio",
    categoriesHeader: "## Categories (% of portfolio right now)",
    riskHeader: "## User risk profile",
    acceptableDrawdown: "Acceptable drawdown",
    targetAllocation: "Target allocation",
    riskNotTaken:
      "Test not taken. Make sure one of the recommendations suggests taking the test and explains the value.",
    observationsHeader:
      "## What rule-based checks noticed (severity 1=critical, 3=observation)",
    finalInstruction:
      "Produce 3–6 recommendations following the schema (level/title/description/action). " +
      "Cover ALL severe observations (severity 1–2) with at least one recommendation. " +
      "Don't repeat yourself, write concisely and to the point.",
  },
};

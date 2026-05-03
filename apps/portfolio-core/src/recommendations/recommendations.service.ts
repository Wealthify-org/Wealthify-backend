import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";

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

interface LlmRecommendationsPayload {
  recommendations: RecommendationDto[];
}

const LLM_SCHEMA: OpenRouterJsonSchema = {
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
              description:
                "Уровень: warning — есть риск, info — наблюдение, positive — хорошее состояние.",
            },
            title: {
              type: "string",
              description: "Короткий заголовок (5–10 слов), без точки в конце.",
            },
            description: {
              type: "string",
              description:
                "Развёрнутое объяснение в 1–3 предложениях, на русском, без воды.",
            },
            action: {
              type: "string",
              description:
                "Конкретное действие, которое стоит сделать (опционально).",
            },
          },
        },
      },
    },
  },
};

/**
 * SYSTEM PROMPT построен по best-practice финансового advisor'а:
 *  - Чёткая роль («криптоаналитик-coach», не financial advisor — мы не лицензированы)
 *  - Образовательная рамка (это анализ структуры, не персональный financial advice)
 *  - Anti-hallucination: оперируй ТОЛЬКО данными из контекста
 *  - Явные refusal rules: никаких прогнозов цен, гарантий, торговых сигналов
 *  - Структурированный thinking pattern: assess → diagnose → propose
 *  - Чёткая шкала уровней с пороговыми правилами
 */
const SYSTEM_PROMPT = `Ты — аналитик криптовалютных портфелей и помощник пользователя, помогающий ему \
улучшить структуру его портфеля. Ты не лицензированный финансовый советник — \
твои рекомендации носят АНАЛИТИКО-ОБРАЗОВАТЕЛЬНЫЙ характер. Ты помогаешь увидеть риски и \
disbalance, но не даёшь индивидуальных торговых указаний.

# Кому ты помогаешь
Пользователю Wealthify — частному криптоинвестору. Он прошёл (или нет) тест риск-профиля; \
ты получаешь его ЦЕЛЕВУЮ АЛЛОКАЦИЮ как ориентир, к которому стоит стремиться.

# Что от тебя нужно
Сформируй 3–6 персональных рекомендаций по оптимизации структуры портфеля.
Каждая должна давать пользователю КОНКРЕТНУЮ новую ценность — без воды, без banalité.

# Структура мышления (применяй к каждой рекомендации)
1. ASSESS — какой факт ты увидел в данных портфеля или наблюдениях
2. DIAGNOSE — почему это важно, какой риск или возможность
3. PROPOSE — что предлагается сделать (по возможности — измеримое действие)

# Уровни (level) — чёткие пороги
- "warning" — реальный риск: концентрация ≥50% в одном активе, существенное \
нарушение целевой аллокации (drift ≥25 п.п.), нехватка стейблкоинов у консервативного \
профиля, чрезмерная доля мелких альтов у не-спекулятивного профиля.
- "info"    — наблюдение / опциональное действие: drift 10–25 п.п., возможность \
перебалансировки, недостаточная диверсификация (3–4 актива).
- "positive" — портфель в хорошей форме по этой метрике (близок к целевой структуре).

# Правила, которые нельзя нарушать
- Опирайся ТОЛЬКО на факты из данных, не выдумывай чисел и фактов.
- Не давай прогнозов цен, не используй фразы вида «будет расти», «обвалится», «купите по $X».
- Не упоминай конкретные ценовые таргеты как guaranteed.
- Не используй маркетинговый или хайп-тон («to the moon», «ракета», «бомба»).
- Пиши на русском, кратко и по делу.
- Заголовок: 5–9 слов, без точки на конце.
- Описание: 1–3 предложения, без воды.
- Если есть конкретный шаг — добавь его в поле "action" (≤200 символов).
- Если у пользователя нет риск-профиля — обязательно одной из рекомендаций \
порекомендуй пройти тест и объясни, почему это улучшит советы.
- Не повторяй одну и ту же мысль в нескольких рекомендациях.

# Тон
Уверенный, спокойный, профессиональный. Как у грамотного аналитика, который \
заботится о капитале пользователя, а не пытается его впечатлить.`;

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
      recommendations = await this.callLlm(portfolio, risk, actualAllocation, observations);
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
      const result = await lastValueFrom(
        this.identityMs.send(RISK_PROFILE_PATTERNS.GET_BY_USER, { userId }),
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
  ): Promise<RecommendationDto[]> {
    const userPrompt = this.buildUserPrompt(
      portfolio,
      risk,
      actualAllocation,
      observations,
    );

    const { data } = await this.openRouter.chatStructured<LlmRecommendationsPayload>(
      LLM_SCHEMA,
      {
        system: SYSTEM_PROMPT,
        user: userPrompt,
        // низкая температура → стабильная структура и тон,
        // плюс одинаковые входы → одинаковые выходы → cache hit ratio выше
        temperature: 0.2,
        topP: 0.9,
        // 800 токенов более чем достаточно для 6 коротких пунктов
        maxTokens: 800,
        // фикс seed: при тех же входах модель даст тот же ответ — больше шанс cache-hit
        seed: 42,
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
  ): string {
    /**
     * Все числа округлены ДО ЦЕЛЫХ для percent-полей и до 1 знака для денег
     * — это намеренно, чтобы мелкий drift цены (например, $9876.54 → $9876.78
     * через минуту) НЕ ломал OpenRouter response cache. Кеш хитится только
     * при идентичном body, поэтому стабильное представление даёт больший hit-rate.
     */
    const lines: string[] = [];
    const round0 = (v: number) => Math.round(v);
    const round1 = (v: number) => Math.round(v * 10) / 10;

    // ── портфель — компактно ─────────────────────────────────────────────
    lines.push("## Портфель");
    lines.push(
      `Стоимость $${round0(portfolio.totalValueUsd)} (вложено $${round0(portfolio.totalInvestedUsd)}). ` +
        `Доходность ${round1(portfolio.totalProfitPct)}%, 24ч ${round1(portfolio.change24hPct)}%. ` +
        `Активов: ${portfolio.assets.length}.`,
    );

    // ── активы — топ-10 в одну строку каждый ─────────────────────────────
    const top = [...portfolio.assets]
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, 10);
    if (top.length) {
      lines.push("");
      lines.push("## Активы (топ-10 по стоимости)");
      for (const a of top) {
        const sharePct = portfolio.totalValueUsd > 0
          ? (a.valueUsd / portfolio.totalValueUsd) * 100
          : 0;
        lines.push(
          `- ${a.ticker} | ${round0(sharePct)}% портфеля | total ${round0(a.profitPct)}% | 24ч ${round0(a.change24HUsdPct)}%`,
        );
      }
    }

    // ── текущая категорийная аллокация ───────────────────────────────────
    lines.push("");
    lines.push("## Категории (% от портфеля сейчас)");
    lines.push(
      `stables ${round0(actual.stables)} | BTC ${round0(actual.btc)} | ETH ${round0(actual.eth)} | largeAlts ${round0(actual.largeAlts)} | smallAlts ${round0(actual.smallAlts)}`,
    );

    // ── риск-профиль ─────────────────────────────────────────────────────
    lines.push("");
    if (risk) {
      const t = risk.targetAllocation;
      lines.push("## Риск-профиль пользователя");
      lines.push(
        `${risk.bucket} (${risk.bucketTitle}). Допустимая просадка ~${risk.acceptableDrawdownPct}%.`,
      );
      lines.push(
        `Целевая аллокация: stables ${t.stables} | BTC ${t.btc} | ETH ${t.eth} | largeAlts ${t.largeAlts} | smallAlts ${t.smallAlts}`,
      );
    } else {
      lines.push("## Риск-профиль");
      lines.push(
        "Тест не пройден. Обязательно одной из рекомендаций предложи пройти тест и объясни ценность.",
      );
    }

    // ── rule-based наблюдения как контекст ───────────────────────────────
    if (observations.length) {
      lines.push("");
      lines.push("## Что заметили правила (severity 1=критично, 3=наблюдение)");
      for (const o of observations) {
        lines.push(`- [s${o.severity}] ${o.fact}`);
      }
    }

    // ── финальная инструкция ─────────────────────────────────────────────
    lines.push("");
    lines.push(
      "Сформируй 3–6 рекомендаций по схеме (level/title/description/action). " +
        "Покрой ВСЕ серьёзные наблюдения (severity 1–2) хотя бы одной рекомендацией. " +
        "Не повторяйся, пиши кратко и по делу.",
    );

    return lines.join("\n");
  }
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom, timeout, of, catchError } from "rxjs";

import { OpenRouterService } from "@libs/openrouter";
import {
  CHAT_HISTORY_PATTERNS,
  ChatHistoryMessage,
  INDEXES_DATA_WORKER_PATTERNS,
  PORTFOLIOS_PATTERNS,
  RISK_PROFILE_PATTERNS,
} from "@libs/contracts";

import {
  IDENTITY_CLIENT,
  INDEXES_CLIENT,
  PORTFOLIO_CLIENT,
} from "./constants";
import { ChatCompletionsDto } from "./chat.dto";

const SAFE_RPC_TIMEOUT_MS = 4_000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * SYSTEM PROMPT — ядро чат-ассистента.
 *
 *  - Чёткая роль: «крипто-аналитик и помощник», не лицензированный financial advisor
 *  - Образовательная рамка: советы — анализ структуры, не «торговые сигналы»
 *  - Всегда учитывает риск-профиль пользователя (если пройден)
 *  - Анализирует фактическое состояние портфелей: доли, прибыли/убытки, drift
 *  - Знает текущий рыночный контекст: F&G, доминация, mcap
 *  - Чёткие refusal rules: не предсказывает цены, не даёт гарантий, не хайпит
 *  - Поощряет прохождение теста риск-профиля если пользователь его не проходил
 *  - Stay-in-scope: крипто, портфель, рынок — нерелевантные вопросы
 *    вежливо возвращает в скоуп
 */
const SYSTEM_PROMPT = `Ты — Wealthify Assistant, крипто-аналитик и помощник пользователя \
платформы Wealthify по управлению криптовалютным портфелем. Ты не лицензированный \
финансовый советник — твои ответы носят АНАЛИТИКО-ОБРАЗОВАТЕЛЬНЫЙ характер.

# Кому ты помогаешь
Частному инвестору в криптовалюты. У тебя в контексте — его реальные данные:
- Все его портфели (название, тип, стоимость, доходность)
- Детали активов в каждом (доля, прибыль, изменение за 24ч)
- Риск-профиль (бакет + целевая аллокация) — или явное "не пройден"
- Текущий снэпшот рынка (Fear & Greed, доминация BTC/ETH, total mcap)

# Как отвечать
1. ВСЕГДА опирайся на ДАННЫЕ ИЗ КОНТЕКСТА. Не выдумывай числа, тикеры, факты.
2. Когда уместно — ССЫЛАЙСЯ на конкретные активы пользователя по тикеру, его доли,
   прибыль/убыток. Это делает ответ персональным.
3. Если у пользователя НЕТ риск-профиля — мягко напомни про тест в одной из реплик
   (и объясни КАК он сделает советы точнее), но не спамь — упомяни один раз.
4. Если у пользователя ЕСТЬ риск-профиль — учитывай его бакет и целевую аллокацию
   в анализе.
5. Структурируй сложные ответы: короткое резюме сверху, потом детали по пунктам.
6. Используй простой русский. Объясняй термины (например, "доминация BTC", "TVL")
   когда вводишь их.

# Тон
Уверенный, спокойный, профессиональный — как у грамотного аналитика, который
заботится о капитале пользователя. Не стесняйся честно сказать о рисках.
Не хайпуй и не пугай.

# Что ты НЕ делаешь
- Не предсказываешь цены. Никаких "BTC вырастет до $200k к маю".
- Не даёшь "торговых сигналов" в стиле "продай прямо сейчас".
- Не утверждаешь как факт то, что является мнением рынка или твоим predict.
- Не используешь хайп-лексику ("ракета", "to the moon", "100x", "easy money").
- Не комментируешь не относящиеся к крипте темы (политика, спорт, не-финансовые
  инвестиции). Если такой вопрос пришёл — вежливо верни в скоуп: «я помогаю
  только с криптовалютным портфелем — давай вернёмся к нему».
- Не выдаёшь себя за лицензированного советника.
- Не берёшь на себя ответственность за решения пользователя.

# Формат
- Короткие абзацы или маркированный список — лучше чем стена текста.
- Если приводишь числа из портфеля — округляй разумно (доля 18.7%, прибыль +12%).
- Если у пользователя есть конкретный риск (концентрация, drift, нехватка стейблов)
  — обозначь это явно и предложи действие.
- В конце уместного ответа — 1 короткая follow-up идея ("Хотите, я разберу
  диверсификацию по категориям?") — но не делай это в каждом ответе.

# Важные напоминания себе
- Это анализ, не investment advice. Окончательное решение всегда за пользователем.
- Если данных мало или вопрос слишком общий — попроси уточнения, не угадывай.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    @Inject(PORTFOLIO_CLIENT) private readonly portfolioMs: ClientProxy,
    @Inject(IDENTITY_CLIENT) private readonly identityMs: ClientProxy,
    @Inject(INDEXES_CLIENT) private readonly indexesMs: ClientProxy,
  ) {}

  /**
   * Главная точка входа — стримит ответ ассистента по токенам.
   *
   * История сохраняется на бекенде:
   *  1) перед стримом сохраняем user-message (последнее в dto.messages)
   *  2) аккумулируем дельты ассистента
   *  3) после успешного завершения сохраняем assistant-message (или partial при отмене ≥30 символов)
   */
  async *streamReply(
    dto: ChatCompletionsDto,
    userId: number,
  ): AsyncGenerator<string, void, void> {
    // 1) сохраняем последнее (user) сообщение ДО запуска стрима — чтобы при
    //    мгновенном reload фронт уже подтянул его из БД
    const lastUser = dto.messages[dto.messages.length - 1];
    if (lastUser?.role === "user") {
      await this.appendHistory(userId, "user", lastUser.content);
    }

    const context = await this.assembleContext(userId, dto.contextPortfolioId);
    const contextBlock = this.formatContext(context);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      // ВАЖНО: контекст идёт как первое user-сообщение, а не system,
      // чтобы модель воспринимала его как "что я знаю о пользователе сейчас"
      // и могла на него ссылаться в ответах.
      {
        role: "user",
        content:
          "Вот текущие данные обо мне и моём портфеле. Используй их при ответах.\n\n" +
          contextBlock,
      },
      // фейк-ассистент acknowledge — улучшает соблюдение инструкций
      {
        role: "assistant",
        content:
          "Принято — учту ваши портфели, риск-профиль и текущее состояние рынка. О чём хотите поговорить?",
      },
      ...dto.messages,
    ];

    // 2) стримим, аккумулируя assistant-content
    let assistantBuffer = "";
    try {
      for await (const delta of this.openRouter.streamChat({
        messages,
        temperature: 0.45,
        topP: 0.9,
        maxTokens: 1200,
        cache: true,
        cacheTtlSeconds: 600,
        provider: { sort: "price", allow_fallbacks: true },
        label: `chat.user_${userId}`,
        timeoutMs: 60_000,
      })) {
        assistantBuffer += delta;
        yield delta;
      }
    } finally {
      // 3) сохраняем assistant-message — даже при отмене сохраняем то, что успело
      // прийти (если хотя бы немного контента, чтобы не плодить пустых записей)
      const trimmed = assistantBuffer.trim();
      if (trimmed.length >= 1) {
        // не блокируем return: запускаем fire-and-forget
        void this.appendHistory(userId, "assistant", trimmed);
      }
    }
  }

  // ── история ─────────────────────────────────────────────────────────────

  async getHistory(userId: number, limit = 60): Promise<ChatHistoryMessage[]> {
    const result = await this.safeRpc<ChatHistoryMessage[]>(
      this.identityMs,
      CHAT_HISTORY_PATTERNS.GET_RECENT,
      { userId, limit },
    );
    return result ?? [];
  }

  async clearHistory(userId: number): Promise<{ deleted: number }> {
    const result = await this.safeRpc<{ deleted: number }>(
      this.identityMs,
      CHAT_HISTORY_PATTERNS.CLEAR,
      { userId },
    );
    return result ?? { deleted: 0 };
  }

  private async appendHistory(
    userId: number,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    try {
      await lastValueFrom(
        this.identityMs
          .send(CHAT_HISTORY_PATTERNS.APPEND, { userId, role, content })
          .pipe(
            timeout(SAFE_RPC_TIMEOUT_MS),
            catchError((err) => {
              this.logger.warn(
                `[chat.history] append failed: ${(err as Error)?.message ?? err}`,
              );
              return of(null);
            }),
          ),
      );
    } catch (e) {
      this.logger.warn(
        `[chat.history] append threw: ${(e as Error)?.message ?? e}`,
      );
    }
  }

  // ── сборка контекста ────────────────────────────────────────────────────

  private async assembleContext(
    userId: number,
    contextPortfolioId?: number,
  ) {
    // все RPC параллельно, каждый с timeout + safe-fallback (null) при ошибке
    const [allPortfolios, currentPortfolio, risk, indexes] = await Promise.all([
      this.safeRpc<{
        portfolios: Array<{ id: number; name: string; type: string }>;
        valuesUsd: number[];
        change24hAbsUsd: number[];
        change24hPct: number[];
      }>(this.portfolioMs, PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER, { userId }),

      contextPortfolioId
        ? this.safeRpc<any>(
            this.portfolioMs,
            PORTFOLIOS_PATTERNS.FIND_DETAIL_BY_ID,
            { id: contextPortfolioId, userId },
          )
        : Promise.resolve(null),

      this.safeRpc<any>(this.identityMs, RISK_PROFILE_PATTERNS.GET_BY_USER, {
        userId,
      }),

      this.safeRpc<any>(
        this.indexesMs,
        INDEXES_DATA_WORKER_PATTERNS.GET_LATEST_SNAPSHOT,
        {},
      ),
    ]);

    return { allPortfolios, currentPortfolio, risk, indexes };
  }

  private async safeRpc<T>(
    client: ClientProxy,
    pattern: string,
    payload: unknown,
  ): Promise<T | null> {
    try {
      const result = await lastValueFrom(
        client.send<T>(pattern, payload).pipe(
          timeout(SAFE_RPC_TIMEOUT_MS),
          catchError((err) => {
            this.logger.warn(
              `[chat.context] RPC "${pattern}" failed: ${(err as Error)?.message ?? err}`,
            );
            return of(null as unknown as T);
          }),
        ),
      );
      return result ?? null;
    } catch (e) {
      this.logger.warn(
        `[chat.context] RPC "${pattern}" threw: ${(e as Error)?.message ?? e}`,
      );
      return null;
    }
  }

  // ── форматирование контекста для модели ─────────────────────────────────

  private formatContext(ctx: {
    allPortfolios: any;
    currentPortfolio: any;
    risk: any;
    indexes: any;
  }): string {
    const lines: string[] = [];
    const round0 = (v: number | null | undefined) =>
      v == null || !Number.isFinite(v) ? "—" : Math.round(v).toString();
    const round1 = (v: number | null | undefined) =>
      v == null || !Number.isFinite(v)
        ? "—"
        : (Math.round(v * 10) / 10).toString();

    // ── все портфели ────────────────────────────────────────────────────
    lines.push("## Все мои портфели");
    if (ctx.allPortfolios?.portfolios?.length) {
      const list = ctx.allPortfolios.portfolios as Array<{
        id: number;
        name: string;
        type: string;
      }>;
      list.forEach((p, i) => {
        const v = ctx.allPortfolios.valuesUsd?.[i] ?? 0;
        const ch24 = ctx.allPortfolios.change24hPct?.[i] ?? 0;
        lines.push(
          `- "${p.name}" (${p.type}, id=${p.id}): $${round0(v)}, 24ч ${round1(ch24)}%`,
        );
      });
    } else {
      lines.push("(портфелей пока нет — пользователь только начал)");
    }

    // ── текущий просматриваемый ─────────────────────────────────────────
    lines.push("");
    if (ctx.currentPortfolio) {
      const cp = ctx.currentPortfolio;
      lines.push(`## Текущий портфель: "${cp.name}" (${cp.type})`);
      lines.push(
        `Стоимость $${round0(cp.totalValueUsd)} (вложено $${round0(cp.totalInvestedUsd)}). ` +
          `Доходность ${round1(cp.totalProfitPct)}%, 24ч ${round1(cp.change24hPct)}%.`,
      );
      const assets = (cp.assets ?? []) as any[];
      if (assets.length) {
        lines.push("");
        lines.push(
          "Холдинги (тикер | доля % | прибыль % | 24ч %):",
        );
        const sorted = [...assets].sort((a, b) => b.valueUsd - a.valueUsd);
        for (const a of sorted) {
          const sharePct =
            cp.totalValueUsd > 0 ? (a.valueUsd / cp.totalValueUsd) * 100 : 0;
          lines.push(
            `- ${a.ticker} | ${round0(sharePct)}% | ${round1(a.profitPct)}% | ${round1(a.change24HUsdPct)}%`,
          );
        }
      }
    } else {
      lines.push(
        "## Текущий портфель: пользователь сейчас не просматривает конкретный портфель",
      );
    }

    // ── риск-профиль ────────────────────────────────────────────────────
    lines.push("");
    if (ctx.risk?.bucket) {
      const t = ctx.risk.targetAllocation;
      lines.push("## Риск-профиль пользователя");
      lines.push(
        `${ctx.risk.bucket} (${ctx.risk.bucketTitle}). Допустимая просадка ~${ctx.risk.acceptableDrawdownPct}%.`,
      );
      lines.push(
        `Целевая аллокация: stables ${t.stables}% | BTC ${t.btc}% | ETH ${t.eth}% | largeAlts ${t.largeAlts}% | smallAlts ${t.smallAlts}%`,
      );
    } else {
      lines.push("## Риск-профиль");
      lines.push(
        "Тест НЕ пройден. Если в разговоре уместно — мягко напомни пользователю пройти тест и объясни ценность (точнее советы, более персональный анализ).",
      );
    }

    // ── рыночный контекст ───────────────────────────────────────────────
    lines.push("");
    if (ctx.indexes) {
      const i = ctx.indexes;
      lines.push("## Текущий рынок");
      lines.push(
        `Fear & Greed: ${i.fearGreedValue} (${i.fearGreedClassification}). ` +
          `Доминация: BTC ${round1(i.btcDominancePct)}%, ETH ${round1(i.ethDominancePct)}%. ` +
          `Total mcap: $${round1((i.totalMarketCapUsd ?? 0) / 1e12)}T (24ч ${round1(i.totalMcapChange24hPct)}%). ` +
          `Altseason index: ${i.altseasonScore} (${i.altseasonLabel}).`,
      );
    } else {
      lines.push("## Текущий рынок");
      lines.push("(данные временно недоступны)");
    }

    return lines.join("\n");
  }
}

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
type Lang = "ru" | "en";

const SYSTEM_PROMPT_RU = `Ты — Wealthify Assistant, крипто-аналитик и помощник пользователя \
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
- Используй **Markdown**: заголовки (\`##\`, \`###\`), **жирный** для ключевых терминов и \
выводов, маркированные/нумерованные списки, \`инлайн-код\` для тикеров и метрик
  (\`BTC\`, \`F&G 40\`). Таблицы — если данных правда много (минимум 3 столбца).
- Короткие абзацы или маркированный список — лучше, чем стена текста.
- Если приводишь числа из портфеля — округляй разумно (доля 18.7%, прибыль +12%).
- Если у пользователя есть конкретный риск (концентрация, drift, нехватка стейблов)
  — обозначь это явно и предложи действие.
- В конце уместного ответа — 1 короткая follow-up идея ("Хотите, я разберу
  диверсификацию по категориям?") — но не делай это в каждом ответе.

# Важные напоминания себе
- Это анализ, не investment advice. Окончательное решение всегда за пользователем.
- Если данных мало или вопрос слишком общий — попроси уточнения, не угадывай.

# Язык
ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ. Даже если пользователь пишет на другом языке — отвечай по-русски.`;

const SYSTEM_PROMPT_EN = `You are Wealthify Assistant, a crypto analyst and helper for a user of the \
Wealthify platform for managing a cryptocurrency portfolio. You are NOT a licensed financial \
advisor — your responses are ANALYTICAL and EDUCATIONAL in nature.

# Who you help
A retail crypto investor. You receive real data in your context:
- All of the user's portfolios (name, type, value, return)
- Detailed asset positions in each (share, profit/loss, 24h change)
- Risk profile (bucket + target allocation) — or an explicit "not taken"
- Current market snapshot (Fear & Greed, BTC/ETH dominance, total mcap)

# How to answer
1. ALWAYS ground your answers in the DATA FROM THE CONTEXT. Don't invent numbers, tickers or facts.
2. Where appropriate, REFERENCE the user's specific assets by ticker, their shares, profit/loss.
   That makes the answer personal.
3. If the user has NO risk profile — gently mention the test in one of your replies (and explain
   HOW it makes the advice more accurate), but don't spam — mention it once.
4. If the user HAS a risk profile — take their bucket and target allocation into account
   in the analysis.
5. Structure complex answers: short summary on top, then bullet-point details.
6. Use simple, clear English. Explain terms (e.g. "BTC dominance", "TVL") when introducing them.

# Tone
Confident, calm, professional — like a thoughtful analyst who cares about the user's capital.
Be honest about risks. Don't hype, don't fearmonger.

# What you do NOT do
- Don't predict prices. No "BTC will hit $200k by May".
- Don't give "trading signals" like "sell right now".
- Don't state market opinions or your predictions as facts.
- Don't use hype lingo ("rocket", "to the moon", "100x", "easy money").
- Don't comment on non-crypto topics (politics, sports, non-financial investments).
  If such a question comes — politely redirect: "I help only with the crypto portfolio —
  let's get back to it."
- Don't pretend to be a licensed advisor.
- Don't take responsibility for the user's decisions.

# Format
- Use **Markdown**: headings (\`##\`, \`###\`), **bold** for key terms and conclusions,
  bullet/numbered lists, \`inline code\` for tickers and metrics (\`BTC\`, \`F&G 40\`).
  Tables — only if the data really warrants it (3+ columns).
- Short paragraphs or bullet points — better than walls of text.
- When citing portfolio numbers — round reasonably (share 18.7%, profit +12%).
- If the user has a concrete risk (concentration, drift, lack of stables) — name it explicitly
  and suggest an action.
- At the end of an apt answer — 1 short follow-up idea ("Want me to break down diversification
  by category?") — but don't do this every single time.

# Reminders to self
- This is analysis, not investment advice. The final decision is always the user's.
- If data is thin or the question is too generic — ask for clarification rather than guessing.

# Language
ANSWER ONLY IN ENGLISH. Even if the user writes in another language — reply in English.`;

const CONTEXT_LEAD_IN: Record<Lang, string> = {
  ru: "Вот текущие данные обо мне и моём портфеле. Используй их при ответах.\n\n",
  en: "Here is the current data about me and my portfolio. Use it when answering.\n\n",
};

const ASSISTANT_ACK: Record<Lang, string> = {
  ru: "Принято — учту ваши портфели, риск-профиль и текущее состояние рынка. О чём хотите поговорить?",
  en: "Got it — I'll take into account your portfolios, risk profile and the current market state. What would you like to discuss?",
};

const SYSTEM_PROMPT: Record<Lang, string> = {
  ru: SYSTEM_PROMPT_RU,
  en: SYSTEM_PROMPT_EN,
};

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

    const lang: Lang = dto.lang ?? "ru";
    const context = await this.assembleContext(userId, dto.contextPortfolioId);
    const contextBlock = this.formatContext(context, lang);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT[lang] },
      // ВАЖНО: контекст идёт как первое user-сообщение, а не system,
      // чтобы модель воспринимала его как "что я знаю о пользователе сейчас"
      // и могла на него ссылаться в ответах.
      {
        role: "user",
        content: CONTEXT_LEAD_IN[lang] + contextBlock,
      },
      // фейк-ассистент acknowledge — улучшает соблюдение инструкций
      {
        role: "assistant",
        content: ASSISTANT_ACK[lang],
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

    // если конкретный портфель НЕ выбран (чат с /home или иной страницы) —
    // подгружаем детали ТОП-N портфелей параллельно, чтобы у модели был состав
    // активов всех портфелей, а не только агрегаты.
    let allPortfoliosDetails: any[] | null = null;
    if (!contextPortfolioId && allPortfolios?.portfolios?.length) {
      const list = allPortfolios.portfolios;
      const values = allPortfolios.valuesUsd ?? [];
      // берём до 5 самых дорогих портфелей — этого хватает на типичного юзера,
      // не раздуваем контекст для пользователя с 20 портфелями
      const topIds = list
        .map((p, i) => ({ id: p.id, value: values[i] ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((x) => x.id);

      allPortfoliosDetails = await Promise.all(
        topIds.map((id) =>
          this.safeRpc<any>(
            this.portfolioMs,
            PORTFOLIOS_PATTERNS.FIND_DETAIL_BY_ID,
            { id, userId },
          ),
        ),
      );
    }

    return {
      allPortfolios,
      currentPortfolio,
      allPortfoliosDetails,
      risk,
      indexes,
    };
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

  private formatContext(
    ctx: {
      allPortfolios: any;
      currentPortfolio: any;
      allPortfoliosDetails: any[] | null;
      risk: any;
      indexes: any;
    },
    lang: Lang,
  ): string {
    const L = CONTEXT_LABELS[lang];
    const lines: string[] = [];
    const round0 = (v: number | null | undefined) =>
      v == null || !Number.isFinite(v) ? "—" : Math.round(v).toString();
    const round1 = (v: number | null | undefined) =>
      v == null || !Number.isFinite(v)
        ? "—"
        : (Math.round(v * 10) / 10).toString();

    // ── все портфели ────────────────────────────────────────────────────
    lines.push(L.allPortfoliosHeader);
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
          `- "${p.name}" (${p.type}, id=${p.id}): $${round0(v)}, ${L.h24} ${round1(ch24)}%`,
        );
      });
    } else {
      lines.push(L.noPortfolios);
    }

    // ── текущий просматриваемый ─────────────────────────────────────────
    lines.push("");
    if (ctx.currentPortfolio) {
      const cp = ctx.currentPortfolio;
      lines.push(`${L.currentPortfolioHeader}: "${cp.name}" (${cp.type})`);
      lines.push(
        `${L.value} $${round0(cp.totalValueUsd)} (${L.invested} $${round0(cp.totalInvestedUsd)}). ` +
          `${L.return} ${round1(cp.totalProfitPct)}%, ${L.h24} ${round1(cp.change24hPct)}%.`,
      );
      const assets = (cp.assets ?? []) as any[];
      if (assets.length) {
        lines.push("");
        lines.push(L.holdingsHeader);
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
      lines.push(L.noCurrentPortfolio);

      // если конкретного портфеля нет — но есть детали ВСЕХ портфелей —
      // выводим состав по каждому, чтобы модель могла рассуждать о холдингах
      const details = (ctx.allPortfoliosDetails ?? []).filter(Boolean);
      if (details.length) {
        for (const d of details) {
          lines.push("");
          lines.push(`### "${d.name}" (${d.type})`);
          lines.push(
            `${L.value} $${round0(d.totalValueUsd)} (${L.invested} $${round0(d.totalInvestedUsd)}). ` +
              `${L.return} ${round1(d.totalProfitPct)}%, ${L.h24} ${round1(d.change24hPct)}%.`,
          );
          const assets = (d.assets ?? []) as any[];
          if (assets.length) {
            lines.push(L.holdingsHeader);
            // топ-8 по стоимости — больше обычно не нужно для анализа
            const sorted = [...assets]
              .sort((a, b) => b.valueUsd - a.valueUsd)
              .slice(0, 8);
            for (const a of sorted) {
              const sharePct =
                d.totalValueUsd > 0 ? (a.valueUsd / d.totalValueUsd) * 100 : 0;
              lines.push(
                `- ${a.ticker} | ${round0(sharePct)}% | ${round1(a.profitPct)}% | ${round1(a.change24HUsdPct)}%`,
              );
            }
          }
        }
      }
    }

    // ── риск-профиль ────────────────────────────────────────────────────
    lines.push("");
    if (ctx.risk?.bucket) {
      const t = ctx.risk.targetAllocation;
      lines.push(L.riskHeader);
      lines.push(
        `${ctx.risk.bucket} (${ctx.risk.bucketTitle}). ${L.acceptableDrawdown} ~${ctx.risk.acceptableDrawdownPct}%.`,
      );
      lines.push(
        `${L.targetAllocation}: stables ${t.stables}% | BTC ${t.btc}% | ETH ${t.eth}% | largeAlts ${t.largeAlts}% | smallAlts ${t.smallAlts}%`,
      );
    } else {
      lines.push(L.riskHeader);
      lines.push(L.riskNotTaken);
    }

    // ── рыночный контекст ───────────────────────────────────────────────
    lines.push("");
    if (ctx.indexes) {
      const i = ctx.indexes;
      lines.push(L.marketHeader);
      lines.push(
        `Fear & Greed: ${i.fearGreedValue} (${i.fearGreedClassification}). ` +
          `${L.dominance}: BTC ${round1(i.btcDominancePct)}%, ETH ${round1(i.ethDominancePct)}%. ` +
          `Total mcap: $${round1((i.totalMarketCapUsd ?? 0) / 1e12)}T (${L.h24} ${round1(i.totalMcapChange24hPct)}%). ` +
          `Altseason index: ${i.altseasonScore} (${i.altseasonLabel}).`,
      );
    } else {
      lines.push(L.marketHeader);
      lines.push(L.marketUnavailable);
    }

    return lines.join("\n");
  }
}

const CONTEXT_LABELS: Record<
  Lang,
  {
    allPortfoliosHeader: string;
    noPortfolios: string;
    currentPortfolioHeader: string;
    value: string;
    invested: string;
    return: string;
    h24: string;
    holdingsHeader: string;
    noCurrentPortfolio: string;
    riskHeader: string;
    acceptableDrawdown: string;
    targetAllocation: string;
    riskNotTaken: string;
    marketHeader: string;
    dominance: string;
    marketUnavailable: string;
  }
> = {
  ru: {
    allPortfoliosHeader: "## Все мои портфели",
    noPortfolios: "(портфелей пока нет — пользователь только начал)",
    currentPortfolioHeader: "## Текущий портфель",
    value: "Стоимость",
    invested: "вложено",
    return: "Доходность",
    h24: "24ч",
    holdingsHeader: "Холдинги (тикер | доля % | прибыль % | 24ч %):",
    noCurrentPortfolio:
      "## Текущий портфель: пользователь сейчас не просматривает конкретный портфель",
    riskHeader: "## Риск-профиль пользователя",
    acceptableDrawdown: "Допустимая просадка",
    targetAllocation: "Целевая аллокация",
    riskNotTaken:
      "Тест НЕ пройден. Если в разговоре уместно — мягко напомни пользователю пройти тест и объясни ценность (точнее советы, более персональный анализ).",
    marketHeader: "## Текущий рынок",
    dominance: "Доминация",
    marketUnavailable: "(данные временно недоступны)",
  },
  en: {
    allPortfoliosHeader: "## All my portfolios",
    noPortfolios: "(no portfolios yet — the user just started)",
    currentPortfolioHeader: "## Current portfolio",
    value: "Value",
    invested: "invested",
    return: "Return",
    h24: "24h",
    holdingsHeader: "Holdings (ticker | share % | profit % | 24h %):",
    noCurrentPortfolio:
      "## Current portfolio: the user is not viewing a specific portfolio right now",
    riskHeader: "## User risk profile",
    acceptableDrawdown: "Acceptable drawdown",
    targetAllocation: "Target allocation",
    riskNotTaken:
      "Test NOT taken. If appropriate in conversation — gently remind the user to take the test and explain the value (more accurate advice, more personal analysis).",
    marketHeader: "## Current market",
    dominance: "Dominance",
    marketUnavailable: "(data temporarily unavailable)",
  },
};

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
 *  - МУЛЬТИ-АКТИВНЫЙ: понимает и крипто-портфели (USD), и портфели акций
 *    MOEX (RUB), и облигации. У пользователя может быть НЕСКОЛЬКО портфелей
 *    разных типов одновременно — ассистент подстраивает анализ под тип каждого.
 *  - Главное правило: не путать классы активов. Не советует крипту в портфель
 *    акций и наоборот; крипто-метрики рынка (доминация BTC, F&G, altseason)
 *    и крипто-целевую аллокацию применяет ТОЛЬКО к крипто-портфелям.
 *  - Образовательная рамка: советы — анализ структуры, не «торговые сигналы»
 *  - Всегда учитывает риск-профиль пользователя (если пройден)
 *  - Чёткие refusal rules: не предсказывает цены, не даёт гарантий, не хайпит
 *  - Stay-in-scope: инвестиционный портфель — нерелевантные вопросы
 *    вежливо возвращает в скоуп
 */
type Lang = "ru" | "en";

const SYSTEM_PROMPT_RU = `Ты — Wealthify Assistant, персональный аналитик инвестиционного портфеля \
пользователя платформы Wealthify. Ты не лицензированный финансовый советник — твои ответы \
носят АНАЛИТИКО-ОБРАЗОВАТЕЛЬНЫЙ характер.

# Кому ты помогаешь
Частному инвестору. У него может быть СРАЗУ НЕСКОЛЬКО портфелей РАЗНЫХ типов:
- Crypto — криптовалюты (BTC, ETH, альткоины, стейблкоины); цены в долларах ($);
- Stock — российские акции с биржи MOEX (Сбербанк, Газпром, Лукойл, Яндекс и т.д.); цены в рублях (₽);
- Bond — облигации.
В контексте ниже у КАЖДОГО портфеля явно указан его тип. ВСЕГДА смотри на тип портфеля \
и подстраивай анализ под него.

# ГЛАВНОЕ ПРАВИЛО — не путай классы активов
- Для КРИПТО-портфеля уместны: BTC/ETH/альткоины/стейблкоины, доминация BTC, Fear & Greed, \
altseason, диверсификация по крипто-категориям.
- Для портфеля АКЦИЙ уместны: отрасли и секторы (нефтегаз, банки, металлурги, IT, ритейл, \
энергетика), концентрация по эмитентам, дивиденды, диверсификация по бумагам и секторам.
- НИКОГДА не советуй докупать криптовалюту (BTC, альты, стейблкоины) в портфель АКЦИЙ — \
и НИКОГДА не советуй акции в крипто-портфель. Рекомендации давай ТОЛЬКО в рамках того \
класса активов, к которому относится портфель.
- Крипто-метрики рынка (доминация BTC, Fear & Greed, altseason, total mcap) и \
крипто-целевая аллокация (стейблы/BTC/ETH/альты) относятся ТОЛЬКО к крипто-портфелям. \
К портфелю акций их НЕ применяй и НЕ ссылайся на них при разборе акций.
- Если вопрос общий (не про конкретный портфель), а у пользователя есть портфели разных \
типов — разбери каждый отдельно, в его собственных терминах.

# Учитывай ВСЕ портфели
- У пользователя может быть несколько портфелей — в контексте ниже перечислены ВСЕ и дан \
состав каждого. По умолчанию рассматривай ВСЕ портфели, а не один.
- Фраза «мой портфель» без уточнения = все портфели пользователя. На вопрос «какие риски \
в моём портфеле?» пройдись по КАЖДОМУ портфелю (крипта, акции, облигации) и дай риски по \
каждому, а в конце — общий вывод по всему капиталу.
- Если один портфель сейчас открыт (он помечен в контексте), можешь начать с него, но НЕ \
игнорируй остальные — обязательно упомяни и их.
- Не выдумывай портфели, которых нет в контексте, и не приписывай пользователю активы \
(например BTC), если их нет в его холдингах.

# Как отвечать
1. ВСЕГДА опирайся на ДАННЫЕ ИЗ КОНТЕКСТА. Не выдумывай числа, тикеры, факты.
2. ССЫЛАЙСЯ на конкретные активы пользователя по тикеру, его доли, прибыль/убыток — \
это делает ответ персональным.
3. Если риск-профиль НЕ пройден — мягко напомни про тест один раз (и зачем он). Если \
пройден — учитывай бакет; крипто-целевую аллокацию применяй только к крипто-части.
4. Структурируй: короткое резюме сверху, потом детали по пунктам.
5. Простой русский, объясняй термины при первом употреблении.

# Тон
Уверенный, спокойный, профессиональный — как у грамотного аналитика, который заботится \
о капитале пользователя. Честно про риски. Без хайпа и запугивания.

# Что ты НЕ делаешь
- Не предсказываешь цены ("BTC до $200k", "Сбер до 500₽к маю").
- Не даёшь торговых сигналов в стиле "продай прямо сейчас".
- Не выдаёшь мнение рынка или свой прогноз за факт.
- Без хайп-лексики ("ракета", "to the moon", "100x", "easy money").
- Не комментируешь не-финансовые темы (политика, спорт). Если такой вопрос пришёл — \
вежливо верни в скоуп: «я помогаю с вашим инвестиционным портфелем — давайте вернёмся к нему».
- Не выдаёшь себя за лицензированного советника и не берёшь ответственность за решения.

# Формат
- **Markdown**: заголовки (\`##\`, \`###\`), **жирный** для ключевого, списки, \`инлайн-код\` \
для тикеров и метрик (\`BTC\`, \`SBER\`, \`F&G 40\`). Таблицы — если данных правда много.
- Короткие абзацы/списки лучше стены текста.
- Числа округляй разумно (доля 18.7%, прибыль +12%). Для акций — рубли (₽), для крипты — доллары ($).
- Заметил конкретный риск (концентрация в одном активе/эмитенте, drift, перекос в один \
сектор, у крипты — нехватка стейблов) — назови явно и предложи действие В РАМКАХ нужного \
класса активов.
- В конце уместного ответа — 1 короткая follow-up идея — но не в каждом ответе.

# Важные напоминания себе
- Это анализ, не investment advice. Окончательное решение всегда за пользователем.
- Если данных мало или вопрос слишком общий — попроси уточнения, не угадывай.

# Язык
ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ. Даже если пользователь пишет на другом языке — отвечай по-русски.`;

const SYSTEM_PROMPT_EN = `You are Wealthify Assistant, a personal investment-portfolio analyst for a user of the \
Wealthify platform. You are NOT a licensed financial advisor — your responses are ANALYTICAL \
and EDUCATIONAL in nature.

# Who you help
A retail investor. They may have SEVERAL portfolios of DIFFERENT types AT THE SAME TIME:
- Crypto — cryptocurrencies (BTC, ETH, altcoins, stablecoins); prices in US dollars ($);
- Stock — Russian equities on the MOEX exchange (Sberbank, Gazprom, Lukoil, Yandex, etc.); prices in rubles (₽);
- Bond — bonds.
In the context below, EACH portfolio's type is stated explicitly. ALWAYS look at a portfolio's \
type and tailor your analysis to it.

# CORE RULE — never mix asset classes
- For a CRYPTO portfolio, appropriate topics are: BTC/ETH/altcoins/stablecoins, BTC dominance, \
Fear & Greed, altseason, diversification across crypto categories.
- For a STOCK portfolio, appropriate topics are: industries and sectors (oil & gas, banks, \
metals & mining, IT, retail, utilities), single-issuer concentration, dividends, diversification \
across names and sectors.
- NEVER suggest buying crypto (BTC, alts, stablecoins) into a STOCK portfolio — and NEVER suggest \
stocks into a crypto portfolio. Give recommendations ONLY within the asset class of that portfolio.
- Crypto market metrics (BTC dominance, Fear & Greed, altseason, total mcap) and the crypto target \
allocation (stables/BTC/ETH/alts) apply ONLY to crypto portfolios. Do NOT apply them to or cite \
them when discussing a stock portfolio.
- If the question is general (not about a specific portfolio) and the user holds portfolios of \
different types — analyze each separately, in its own terms.

# Consider ALL portfolios
- The user may have several portfolios — the context below lists ALL of them with each one's \
holdings. By default, consider ALL portfolios, not just one.
- "My portfolio" with no qualifier = all of the user's portfolios. For "what are the risks in \
my portfolio?", go through EACH portfolio (crypto, stocks, bonds) and give its risks, then end \
with an overall conclusion across the whole capital.
- If one portfolio is currently open (marked in the context), you may lead with it, but do NOT \
ignore the others — be sure to mention them too.
- Never invent portfolios that aren't in the context, and never attribute assets to the user \
(e.g. BTC) that aren't in their holdings.

# How to answer
1. ALWAYS ground your answers in the DATA FROM THE CONTEXT. Don't invent numbers, tickers or facts.
2. REFERENCE the user's specific assets by ticker, their shares, profit/loss — it makes the answer personal.
3. If the user has NO risk profile — gently mention the test once (and why it helps). If they HAVE \
one — use the bucket; apply the crypto target allocation only to the crypto part.
4. Structure complex answers: short summary on top, then bullet-point details.
5. Use simple, clear English. Explain terms on first use.

# Tone
Confident, calm, professional — like a thoughtful analyst who cares about the user's capital.
Be honest about risks. Don't hype, don't fearmonger.

# What you do NOT do
- Don't predict prices ("BTC to $200k", "Sber to ₽500 by May").
- Don't give "trading signals" like "sell right now".
- Don't state market opinions or your predictions as facts.
- Don't use hype lingo ("rocket", "to the moon", "100x", "easy money").
- Don't comment on non-financial topics (politics, sports). If such a question comes — politely \
redirect: "I help with your investment portfolio — let's get back to it."
- Don't pretend to be a licensed advisor or take responsibility for the user's decisions.

# Format
- Use **Markdown**: headings (\`##\`, \`###\`), **bold** for key terms, lists, \`inline code\` for \
tickers and metrics (\`BTC\`, \`SBER\`, \`F&G 40\`). Tables — only if the data really warrants it.
- Short paragraphs or bullet points — better than walls of text.
- Round reasonably (share 18.7%, profit +12%). Stocks — rubles (₽), crypto — dollars ($).
- If there's a concrete risk (single-asset/issuer concentration, drift, single-sector tilt, or — \
for crypto — lack of stables) — name it explicitly and suggest an action WITHIN the right asset class.
- At the end of an apt answer — 1 short follow-up idea — but not every single time.

# Reminders to self
- This is analysis, not investment advice. The final decision is always the user's.
- If data is thin or the question is too generic — ask for clarification rather than guessing.

# Language
ANSWER ONLY IN ENGLISH. Even if the user writes in another language — reply in English.`;

const CONTEXT_LEAD_IN: Record<Lang, string> = {
  ru:
    "Вот текущие данные обо мне и моих портфелях. Используй их при ответах. " +
    "У каждого портфеля указан ТИП (Crypto/Stock/Bond) — подстраивай анализ под него. " +
    "Денежные суммы приведены к USD для сравнения; для портфелей акций реальная " +
    "торговая валюта — рубли (₽), поэтому опирайся на ДОЛИ и проценты, а не на absolute-$.\n\n",
  en:
    "Here is the current data about me and my portfolios. Use it when answering. " +
    "Each portfolio has a TYPE (Crypto/Stock/Bond) — tailor your analysis to it. " +
    "Monetary amounts are normalized to USD for comparison; for stock portfolios the real " +
    "trading currency is rubles (₽), so rely on SHARES and percentages rather than the absolute $.\n\n",
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
        model: "anthropic/claude-haiku-4.5",
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
    const [allPortfolios, risk, indexes] = await Promise.all([
      this.safeRpc<{
        portfolios: Array<{ id: number; name: string; type: string }>;
        valuesUsd: number[];
        change24hAbsUsd: number[];
        change24hPct: number[];
      }>(this.portfolioMs, PORTFOLIOS_PATTERNS.FIND_ALL_BY_USER, { userId }),

      this.safeRpc<any>(this.identityMs, RISK_PROFILE_PATTERNS.GET_BY_USER, {
        userId,
      }),

      this.safeRpc<any>(
        this.indexesMs,
        INDEXES_DATA_WORKER_PATTERNS.GET_LATEST_SNAPSHOT,
        {},
      ),
    ]);

    // ВСЕГДА подгружаем детальный состав ВСЕХ портфелей (до N штук), даже если
    // пользователь сейчас открыл конкретный портфель. Иначе ассистент видел
    // холдинги только одного портфеля и рассуждал лишь о нём, игнорируя
    // остальные (например, у юзера крипта + акции + облигации, а совет — только
    // про крипту). Открытый портфель гарантированно попадает в выборку и
    // помечается отдельно.
    let allPortfoliosDetails: any[] | null = null;
    if (allPortfolios?.portfolios?.length) {
      const list = allPortfolios.portfolios;
      const values = allPortfolios.valuesUsd ?? [];
      // до 6 самых дорогих портфелей — хватает типичному юзеру, не раздувает
      // контекст у того, у кого их десятки
      const topIds = list
        .map((p, i) => ({ id: p.id, value: values[i] ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
        .map((x) => x.id);

      // гарантируем, что открытый портфель есть в выборке, даже если он не в топ-6
      if (
        contextPortfolioId &&
        list.some((p) => p.id === contextPortfolioId) &&
        !topIds.includes(contextPortfolioId)
      ) {
        topIds.pop();
        topIds.unshift(contextPortfolioId);
      }

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
      contextPortfolioId: contextPortfolioId ?? null,
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
      contextPortfolioId: number | null;
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

    // Есть ли у пользователя ХОТЯ БЫ один крипто-портфель. Если нет — крипто-
    // целевую аллокацию (стейблы/BTC/ETH/альты) и крипто-рынок (доминация, F&G)
    // НЕ показываем: иначе модель может «придумать» крипто-портфель и дать совет
    // про BTC юзеру, у которого только акции/облигации.
    const portfolioTypes: string[] = [
      ...(((ctx.allPortfolios?.portfolios ?? []) as Array<{ type?: string }>).map(
        (p) => p.type ?? "",
      )),
      ...(((ctx.allPortfoliosDetails ?? []).filter(Boolean) as Array<{
        type?: string;
      }>).map((d) => d.type ?? "")),
    ];
    const hasCrypto = portfolioTypes.some((t) =>
      (t ?? "").toLowerCase().startsWith("crypto"),
    );

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

    // ── состав КАЖДОГО портфеля ──────────────────────────────────────────
    // Всегда выводим холдинги по всем портфелям, чтобы ассистент рассуждал обо
    // ВСЕХ, а не только об открытом. Открытый помечаем отдельно.
    lines.push("");
    {
      const details = (ctx.allPortfoliosDetails ?? []).filter(Boolean);
      if (details.length) {
        lines.push(L.breakdownHeader);
        for (const d of details) {
          const isCurrent =
            ctx.contextPortfolioId != null && d.id === ctx.contextPortfolioId;
          lines.push("");
          lines.push(
            `### "${d.name}" (${d.type})${isCurrent ? ` — ${L.currentlyViewing}` : ""}`,
          );
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
      // крипто-целевая аллокация — только если есть крипто-портфель
      if (hasCrypto && t) {
        lines.push(
          `${L.targetAllocation}: stables ${t.stables}% | BTC ${t.btc}% | ETH ${t.eth}% | largeAlts ${t.largeAlts}% | smallAlts ${t.smallAlts}%`,
        );
      }
    } else {
      lines.push(L.riskHeader);
      lines.push(L.riskNotTaken);
    }

    // ── рыночный контекст (крипто) ──────────────────────────────────────
    // Показываем ТОЛЬКО если у пользователя есть крипто-портфель — иначе эти
    // метрики нерелевантны и сбивают модель на крипто-тематику.
    if (hasCrypto) {
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
    }

    return lines.join("\n");
  }
}

const CONTEXT_LABELS: Record<
  Lang,
  {
    allPortfoliosHeader: string;
    noPortfolios: string;
    breakdownHeader: string;
    currentlyViewing: string;
    value: string;
    invested: string;
    return: string;
    h24: string;
    holdingsHeader: string;
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
    breakdownHeader: "## Состав каждого портфеля (анализируй ВСЕ, а не только один)",
    currentlyViewing: "пользователь сейчас открыл этот портфель",
    value: "Стоимость",
    invested: "вложено",
    return: "Доходность",
    h24: "24ч",
    holdingsHeader: "Холдинги (тикер | доля % | прибыль % | 24ч %):",
    riskHeader: "## Риск-профиль пользователя",
    acceptableDrawdown: "Допустимая просадка",
    targetAllocation:
      "Целевая КРИПТО-аллокация (применяется ТОЛЬКО к крипто-портфелям; к акциям не относится)",
    riskNotTaken:
      "Тест НЕ пройден. Если в разговоре уместно — мягко напомни пользователю пройти тест и объясни ценность (точнее советы, более персональный анализ).",
    marketHeader:
      "## Крипто-рынок (актуально ТОЛЬКО для крипто-активов; на портфели акций MOEX не влияет)",
    dominance: "Доминация",
    marketUnavailable: "(данные временно недоступны)",
  },
  en: {
    allPortfoliosHeader: "## All my portfolios",
    noPortfolios: "(no portfolios yet — the user just started)",
    breakdownHeader: "## Breakdown of EACH portfolio (analyze ALL of them, not just one)",
    currentlyViewing: "the user currently has this portfolio open",
    value: "Value",
    invested: "invested",
    return: "Return",
    h24: "24h",
    holdingsHeader: "Holdings (ticker | share % | profit % | 24h %):",
    riskHeader: "## User risk profile",
    acceptableDrawdown: "Acceptable drawdown",
    targetAllocation:
      "Target CRYPTO allocation (applies ONLY to crypto portfolios; not relevant to stocks)",
    riskNotTaken:
      "Test NOT taken. If appropriate in conversation — gently remind the user to take the test and explain the value (more accurate advice, more personal analysis).",
    marketHeader:
      "## Crypto market (relevant ONLY to crypto holdings; does not affect MOEX stock portfolios)",
    dominance: "Dominance",
    marketUnavailable: "(data temporarily unavailable)",
  },
};

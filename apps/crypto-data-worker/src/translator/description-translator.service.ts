import { Injectable, Logger } from "@nestjs/common";
import * as cheerio from "cheerio";
import { OpenRouterService } from "@libs/openrouter";

// cheerio v1.x перенёс типы Node в `domhandler`, но импортить отдельную
// зависимость избыточно — используем local-типы (DOM-узлы у cheerio
// имеют поле .type как литерал-string и .data на text-узлах).
type CheerioNode = {
  type: string;
  data?: string;
  children?: CheerioNode[];
  [k: string]: unknown;
};

/**
 * HTML-safe перевод английского описания актива на русский.
 *
 * Алгоритм:
 *  1. Парсим входящий HTML через cheerio (без обёртки <html>/<body>).
 *  2. Обходим DOM-дерево, собираем все text-узлы (то что между тегами).
 *  3. Фильтруем пустые / только-whitespace.
 *  4. Один раз шлём в OpenRouter через jsonSchema-ответ — массив строк
 *     гарантированной длины. Использует ту же модель что чат
 *     (`google/gemma-4-31b-it` по умолчанию или из `OPEN_ROUTER_MODEL`).
 *  5. Каждый text-узел в DOM подменяется на свой перевод по индексу.
 *  6. Серилизуем DOM обратно в строку — ВСЕ теги, атрибуты, ссылки и
 *     структура (ul/li/p/strong/a/...) сохраняются точно как были.
 *
 * Почему так, а не «дать LLM сразу HTML»:
 *  - LLM норовят менять регистр атрибутов, лишние пробелы в тегах,
 *    ломать вложенность, exscape-ить кавычки нестабильно. На длинных
 *    текстах это превращает вёрстку в мусор.
 *  - Подход «текстовые ноды отдельно» гарантирует bit-perfect разметку.
 */
@Injectable()
export class DescriptionTranslatorService {
  private readonly log = new Logger(DescriptionTranslatorService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  /**
   * Переводит входной HTML-фрагмент на русский, сохраняя разметку.
   * При любых сбоях (пустой ввод, нет text-нод, ошибка LLM, длина массива
   * не совпала) возвращает оригинальный HTML — лучше английский чем
   * битая вёрстка.
   *
   * Возвращает `{ html, complete }`:
   *  - `complete=true`  — все чанки успешно переведены, можно кешировать
   *  - `complete=false` — хотя бы один чанк сорвался (упал по сети, отдал
   *    мусор, length-mismatch), в результате может быть mix RU+EN. Отдавать
   *    юзеру МОЖНО (лучше чем полный EN), но **в БД не сохранять**, иначе
   *    «прибитый» mix останется навсегда.
   */
  async translateHtmlToRussian(
    html: string,
  ): Promise<{ html: string; complete: boolean }> {
    if (!html || typeof html !== "string") return { html, complete: false };

    // cheerio.load с `null, false` — не оборачивает в <html><body>.
    // xmlMode НЕ включаем чтобы сохранилось HTML-поведение (не самозакрытие).
    const $ = cheerio.load(html, null, false);

    // Собираем text-узлы. Применяем фильтр — пробельные / очень короткие
    // (1 символ типа &nbsp; или знаки препинания) пропускаем, чтобы не
    // тратить токены и не сбивать LLM мусорными фрагментами.
    type TextNodeRef = { node: CheerioNode; idx: number };
    const textRefs: TextNodeRef[] = [];

    const walk = (nodes: CheerioNode[]) => {
      for (const n of nodes) {
        if (n.type === "text") {
          const data = n.data ?? "";
          if (data.trim().length >= 2) {
            textRefs.push({ node: n, idx: textRefs.length });
          }
        } else if (n.type === "tag" || n.type === "root") {
          const children = n.children ?? [];
          if (children.length) walk(children);
        }
      }
    };
    walk($.root().contents().toArray() as unknown as CheerioNode[]);

    if (!textRefs.length) {
      this.log.debug("translate: nothing to translate (no text nodes)");
      return { html, complete: true };
    }

    const originals = textRefs.map((t) => (t.node.data ?? "").trim());

    // Чанкуем по символам. Размер 5000 — нашли опытным путём:
    //  - 8K → постоянно тaймаутятся (free-модель не успевает за 60с)
    //  - 3K → много чанков → много overhead на сетевой latency
    //  - 5K → чанки укладываются в 30-60с, BTC 21K делится на 4 чанка
    const CHUNK_CHAR_LIMIT = 5000;
    const chunks: { startIdx: number; texts: string[] }[] = [];
    let curStart = 0;
    let curLen = 0;
    let curTexts: string[] = [];
    originals.forEach((t, i) => {
      const tLen = t.length;
      if (curTexts.length && curLen + tLen > CHUNK_CHAR_LIMIT) {
        chunks.push({ startIdx: curStart, texts: curTexts });
        curStart = i;
        curLen = 0;
        curTexts = [];
      }
      curTexts.push(t);
      curLen += tLen;
    });
    if (curTexts.length) chunks.push({ startIdx: curStart, texts: curTexts });

    this.log.debug(
      `translate: ${originals.length} text-nodes split into ${chunks.length} chunk(s)`,
    );

    let translations: string[];
    let allChunksOk = true;
    try {
      // Параллельно с ограничением 2 одновременных. Free-модель
      // `gpt-oss-120b:free` нормально держит 2 параллельных запроса
      // (одиночный — медленный). Больше — начинаются upstream errors.
      // Каждый чанк имеет 2 ретрая на свой счёт.
      const CONCURRENCY = 2;
      const results: string[][] = new Array(chunks.length);
      let cursor = 0;
      const workers = new Array(Math.min(CONCURRENCY, chunks.length))
        .fill(0)
        .map(async () => {
          while (true) {
            const myIdx = cursor++;
            if (myIdx >= chunks.length) return;
            const c = chunks[myIdx];
            const part = await this.translateChunkWithRetry(c.texts, 2);
            if (Array.isArray(part) && part.length === c.texts.length) {
              results[myIdx] = part;
            } else {
              this.log.warn(
                `translate: chunk ${myIdx + 1}/${chunks.length} failed — keeping originals (will NOT cache)`,
              );
              // фоллбек на английский для этого чанка, но помечаем
              // весь перевод как incomplete → caller не будет кешировать
              results[myIdx] = c.texts;
              allChunksOk = false;
            }
          }
        });
      await Promise.all(workers);
      translations = results.flat();
    } catch (e) {
      this.log.warn(
        `translate: outer error, returning original — ${
          e instanceof Error ? e.message : e
        }`,
      );
      return { html, complete: false };
    }

    if (!Array.isArray(translations) || translations.length !== originals.length) {
      this.log.warn(
        `translate: length mismatch original=${originals.length} got=${translations?.length ?? "?"} — falling back to original`,
      );
      return { html, complete: false };
    }

    // Подменяем каждый узел на свой перевод. Сохраняем leading/trailing
    // whitespace оригинала чтобы не «слипались» соседние теги (например
    // `Bitcoin <strong>price</strong>` → если убрать пробел перед strong,
    // получим `Биткоин<strong>цена</strong>`).
    textRefs.forEach((t, i) => {
      const orig = t.node.data ?? "";
      const leading = orig.match(/^\s*/)?.[0] ?? "";
      const trailing = orig.match(/\s*$/)?.[0] ?? "";
      const translated = translations[i];
      if (typeof translated === "string" && translated.length) {
        t.node.data = leading + translated + trailing;
      }
    });

    return { html: $.html(), complete: allChunksOk };
  }

  /**
   * Модель для перевода — бесплатный `openai/gpt-oss-120b:free` на
   * OpenRouter. Не списывается с баланса. Для надёжности НЕ используем
   * `json_schema` — у free-модели часть провайдеров его не поддерживают
   * и возвращают upstream-ошибки. Вместо этого просим JSON в промпте и
   * парсим вручную из текстового ответа (см. extractJsonArray).
   */
  private static readonly TRANSLATION_MODEL = "openai/gpt-oss-120b:free";

  /**
   * Перевод одного чанка с ретраями. Free-модель часто возвращает пустой
   * ответ из-за rate-limit / временных перегрузок — повторяем с паузой.
   */
  private async translateChunkWithRetry(
    texts: string[],
    maxAttempts: number,
  ): Promise<string[] | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const part = await this.translateBatch(texts);
        if (Array.isArray(part) && part.length === texts.length) {
          return part;
        }
        this.log.warn(
          `translateChunk attempt ${attempt}/${maxAttempts}: length mismatch (got ${part?.length ?? "?"} expected ${texts.length})`,
        );
      } catch (e) {
        this.log.warn(
          `translateChunk attempt ${attempt}/${maxAttempts} failed: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
      if (attempt < maxAttempts) {
        // экспоненциальный backoff: 2с, 4с, 8с
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    return null;
  }

  /**
   * Один батчевый запрос к OpenRouter. Возвращает массив переводов в
   * том же порядке. Через jsonSchema гарантируется структура ответа.
   */
  private async translateBatch(texts: string[]): Promise<string[]> {
    const system = [
      "Ты профессиональный переводчик с английского на русский, специализирующийся на криптовалютах, блокчейне и финансах.",
      "На входе ты получаешь JSON: { \"texts\": [\"фрагмент1\", \"фрагмент2\", ...] }.",
      "На выходе верни СТРОГО JSON: { \"translations\": [\"перевод1\", \"перевод2\", ...] } — без markdown, без префиксов, без комментариев.",
      "Длина массива translations должна точно совпадать с длиной texts.",
      "Правила перевода:",
      "1. Переводи естественно для русскоязычного инвестора, не подстрочно.",
      "2. Имена собственные, тикеры, названия проектов и фамилии оставляй как есть (Bitcoin, Ethereum, Vitalik Buterin, BTC).",
      "3. URL и адреса не трогай.",
      "4. НЕ добавляй HTML-теги — на входе их нет, на выходе тоже не должно быть.",
      "5. Сохраняй пунктуацию и структуру предложений.",
      "6. Не объединяй и не разделяй фрагменты — массив длины N даёт массив длины N.",
    ].join("\n");

    const userPayload = JSON.stringify({ texts });

    const { text } = await this.openRouter.chat({
      model: DescriptionTranslatorService.TRANSLATION_MODEL,
      system,
      user: userPayload,
      // json_schema НЕ используем — провайдеры под free-моделью часто
      // не поддерживают (возвращают `Json mode is not supported` или
      // пустые ответы). Просим JSON в промпте, парсим извлечением.
      temperature: 0.2,
      maxTokens: 4096,
      // 90 секунд — free-модель отвечает 30-60с, иногда дольше при
      // нагрузке. Перестраховываемся.
      timeoutMs: 90_000,
      cache: false,
      label: "translate.description",
    });

    if (!text || text.trim().length === 0) {
      throw new Error("LLM returned empty response");
    }

    return DescriptionTranslatorService.extractTranslationsArray(text);
  }

  /**
   * Извлекает массив `translations` из текстового ответа LLM.
   * Свободная модель иногда оборачивает JSON в markdown-блок
   * ```json ... ```, иногда добавляет префикс «Here's the JSON:».
   * Поэтому ищем первый JSON-объект и пробуем распарсить.
   */
  private static extractTranslationsArray(raw: string): string[] {
    // 1) Удаляем markdown-обёртку если есть
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      // ```json\n{...}\n``` → {...}
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }

    // 2) Прямой JSON.parse
    const tryParse = (s: string): string[] | null => {
      try {
        const obj = JSON.parse(s) as { translations?: unknown };
        if (Array.isArray(obj.translations)) {
          return obj.translations.map((x) => (typeof x === "string" ? x : String(x)));
        }
        return null;
      } catch {
        return null;
      }
    };

    let arr = tryParse(cleaned);
    if (arr) return arr;

    // 3) Если вокруг есть мусор — найдём первую {...}-обёртку.
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      arr = tryParse(objMatch[0]);
      if (arr) return arr;
    }

    throw new Error(
      `LLM returned unparseable JSON. First 120 chars: ${cleaned.slice(0, 120)}`,
    );
  }
}

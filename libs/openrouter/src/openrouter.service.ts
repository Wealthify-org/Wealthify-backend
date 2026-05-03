import { Injectable, Logger } from "@nestjs/common";
import {
  OpenRouterChatRequest,
  OpenRouterChatResponse,
  OpenRouterError,
  OpenRouterJsonSchema,
  OpenRouterMessage,
  OpenRouterProviderRouting,
} from "./openrouter.types";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemma-4-31b-it";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2; // итого до 3 попыток (исходная + 2 ретрая)
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface OpenRouterChatOptions {
  /** Системный промпт (роль "system"). */
  system?: string;
  /** Пользовательское сообщение (роль "user"). Альтернатива messages. */
  user?: string;
  /** Полный массив messages. Если задан — system/user игнорируются. */
  messages?: OpenRouterMessage[];

  /** Переопределить модель (по умолчанию из env / DEFAULT_MODEL). */
  model?: string;

  /** Структурированный JSON-выход. */
  jsonSchema?: OpenRouterJsonSchema;

  // generation params
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  seed?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;

  /** Маршрутизация провайдеров (например, sort: "price"). */
  provider?: OpenRouterProviderRouting;

  /**
   * Включить response-кеширование на стороне OpenRouter.
   * При cache-hit запрос НЕ оплачивается. Совпадает по
   * (apiKey, model, endpoint, streamingMode, body) — то есть body должен быть
   * идентичным для попадания в кеш.
   * https://openrouter.ai/docs/guides/features/response-caching
   */
  cache?: boolean;
  /** TTL кеша в секундах, 1..86400. По умолчанию 300 (5 мин). */
  cacheTtlSeconds?: number;

  /** Таймаут для одного HTTP-запроса. */
  timeoutMs?: number;

  /** Лейбл для логов. */
  label?: string;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  private get apiKey(): string {
    const key = process.env.OPEN_ROUTER_API_KEY;
    if (!key) {
      throw new Error(
        "OPEN_ROUTER_API_KEY is not set in env. Cannot call OpenRouter.",
      );
    }
    return key;
  }

  private get baseUrl(): string {
    return process.env.OPEN_ROUTER_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private get defaultModel(): string {
    return process.env.OPEN_ROUTER_MODEL ?? DEFAULT_MODEL;
  }

  /**
   * Низкоуровневый chat-completion вызов.
   * Возвращает первый choice и raw-ответ.
   */
  async chat(options: OpenRouterChatOptions): Promise<{
    text: string;
    raw: OpenRouterChatResponse;
  }> {
    const messages = this.buildMessages(options);
    const body: OpenRouterChatRequest = {
      model: options.model ?? this.defaultModel,
      messages,
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      max_tokens: options.maxTokens,
      seed: options.seed,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      provider: options.provider,
    };
    if (options.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: options.jsonSchema,
      };
    }

    const raw = await this.callWithRetry(body, options);
    const text = raw.choices?.[0]?.message?.content ?? "";
    return { text, raw };
  }

  /**
   * Streaming chat-completion. Возвращает AsyncGenerator content-дельт.
   * Используется для real-time UX (chat-бот, набор по токену).
   *
   * Парсит SSE-формат OpenAI-compatible: каждое сообщение
   *   data: {"choices":[{"delta":{"content":"..."}}]}\n\n
   * заканчивается
   *   data: [DONE]\n\n
   *
   * Не делает retries (стрим частично доехал → нельзя дотянуть). Если нужны
   * retries — оборачивай вызывающий код.
   */
  async *streamChat(
    options: OpenRouterChatOptions,
  ): AsyncGenerator<string, void, void> {
    const messages = this.buildMessages(options);
    const body: OpenRouterChatRequest & { stream: true } = {
      stream: true,
      model: options.model ?? this.defaultModel,
      messages,
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      max_tokens: options.maxTokens,
      seed: options.seed,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      provider: options.provider,
    };
    if (options.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: options.jsonSchema,
      };
    }

    const label = options.label ?? "openrouter.stream";
    const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const startedAt = Date.now();

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(options),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        this.logger.warn(
          `[${label}] stream HTTP ${res.status}. body: ${text.slice(0, 250)}`,
        );
        throw this.toError(res.status, text);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let totalChars = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE-сообщения разделяются двойным \n
        let separatorIdx: number;
        while ((separatorIdx = buffer.indexOf("\n\n")) >= 0) {
          const rawEvent = buffer.slice(0, separatorIdx);
          buffer = buffer.slice(separatorIdx + 2);
          if (!rawEvent.trim()) continue;

          // событие может состоять из нескольких строк — нас интересуют data:
          for (const line of rawEvent.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]" || payload === "") continue;

            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length) {
                totalChars += delta.length;
                yield delta;
              }
            } catch {
              // ignore non-JSON keepalive lines
            }
          }
        }
      }

      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `[${label}] stream done in ${elapsed}ms (${totalChars} chars)`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Удобный helper: запрашивает structured-output (json_schema) и возвращает
   * уже распарсенный JSON. Throws при невалидном ответе.
   */
  async chatStructured<T>(
    schema: OpenRouterJsonSchema,
    options: Omit<OpenRouterChatOptions, "jsonSchema">,
  ): Promise<{ data: T; raw: OpenRouterChatResponse }> {
    const { text, raw } = await this.chat({ ...options, jsonSchema: schema });
    if (!text.trim()) {
      throw new Error(
        `OpenRouter returned empty content for schema "${schema.name}"`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const preview = text.slice(0, 200);
      throw new Error(
        `OpenRouter returned non-JSON content for schema "${schema.name}". Preview: ${preview}…`,
      );
    }
    return { data: parsed as T, raw };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private buildMessages(opts: OpenRouterChatOptions): OpenRouterMessage[] {
    if (opts.messages && opts.messages.length) return opts.messages;
    const messages: OpenRouterMessage[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    if (opts.user) messages.push({ role: "user", content: opts.user });
    if (!messages.length) {
      throw new Error(
        "OpenRouterService.chat: empty messages — provide messages or system/user",
      );
    }
    return messages;
  }

  /**
   * Делает HTTP-вызов с экспоненциальным backoff'ом для retryable-ошибок.
   */
  private async callWithRetry(
    body: OpenRouterChatRequest,
    options: OpenRouterChatOptions,
  ): Promise<OpenRouterChatResponse> {
    const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const label = options.label ?? "openrouter";

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const startedAt = Date.now();
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: this.buildHeaders(options),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const elapsed = Date.now() - startedAt;
          const retryable = RETRYABLE_STATUSES.has(res.status);
          this.logger.warn(
            `[${label}] OpenRouter HTTP ${res.status} after ${elapsed}ms (attempt ${attempt + 1}). retryable=${retryable}. body: ${text.slice(0, 250)}`,
          );

          if (retryable && attempt < MAX_RETRIES) {
            await this.sleep(this.backoffMs(attempt));
            continue;
          }
          throw this.toError(res.status, text);
        }

        const json = (await res.json()) as OpenRouterChatResponse | OpenRouterError;
        if ("error" in json) {
          throw new Error(
            `OpenRouter API error: ${json.error.message ?? "unknown"}`,
          );
        }
        const elapsed = Date.now() - startedAt;
        const usage = json.usage;
        const cacheHit = res.headers.get("x-or-cache-hit") === "true";
        this.logger.log(
          `[${label}] OpenRouter ok in ${elapsed}ms model=${json.model} tokens=${usage?.total_tokens ?? "?"} (in=${usage?.prompt_tokens ?? "?"}, out=${usage?.completion_tokens ?? "?"})${cacheHit ? " [cache HIT]" : ""}`,
        );
        return json;
      } catch (err) {
        const aborted = (err as Error)?.name === "AbortError";
        if (aborted) {
          this.logger.warn(
            `[${label}] OpenRouter timeout after ${timeout}ms (attempt ${attempt + 1})`,
          );
          if (attempt < MAX_RETRIES) {
            await this.sleep(this.backoffMs(attempt));
            continue;
          }
        }
        lastError = err;
        // если не network-error и не таймаут — выбрасываем сразу
        if (!aborted && attempt >= MAX_RETRIES) break;
        if (!aborted) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("OpenRouter call failed");
  }

  private buildHeaders(options: OpenRouterChatOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    // referer/title — для лидерборда OpenRouter (опционально, рекомендовано)
    const referer = process.env.OPEN_ROUTER_REFERER ?? process.env.WEB_ORIGIN;
    if (referer) headers["HTTP-Referer"] = referer;
    const title = process.env.OPEN_ROUTER_TITLE ?? "Wealthify";
    headers["X-Title"] = title;

    // response caching: при cache-hit запрос не оплачивается (даже на платных моделях).
    // Cache-key = (apiKey, model, endpoint, streamingMode, body) — body должен быть identical.
    if (options.cache) {
      headers["X-OpenRouter-Cache"] = "true";
      const ttl = Math.max(
        1,
        Math.min(86_400, options.cacheTtlSeconds ?? 600),
      );
      headers["X-OpenRouter-Cache-TTL"] = String(ttl);
    }

    return headers;
  }

  private toError(status: number, body: string): Error {
    const err = new Error(
      `OpenRouter HTTP ${status}: ${body.slice(0, 200)}`,
    );
    (err as Error & { status?: number }).status = status;
    return err;
  }

  private backoffMs(attempt: number): number {
    // 400ms, 1200ms (экспоненциальный с джиттером)
    const base = 400 * Math.pow(3, attempt);
    const jitter = Math.random() * 200;
    return base + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

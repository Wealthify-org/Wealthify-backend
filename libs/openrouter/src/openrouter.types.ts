/**
 * Типы для OpenRouter API.
 * Базовый OpenAI-совместимый формат /chat/completions с расширениями OpenRouter.
 *
 * Документация: https://openrouter.ai/docs/api/reference/overview
 */

export type OpenRouterRole = "system" | "user" | "assistant" | "tool";

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * JSON Schema для structured-outputs.
 * https://openrouter.ai/docs/guides/features/structured-outputs
 */
export interface OpenRouterJsonSchema {
  /** имя схемы — короткий идентификатор (обязательно) */
  name: string;
  /** строгий режим — модель обязана следовать схеме точно */
  strict: boolean;
  /** сама JSON-схема */
  schema: Record<string, unknown>;
}

export type OpenRouterResponseFormat =
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: OpenRouterJsonSchema };

/**
 * Конфигурация маршрутизации провайдеров OpenRouter.
 * https://openrouter.ai/docs/guides/routing/provider-selection
 */
export interface OpenRouterProviderRouting {
  /** "price" — самый дешёвый, "throughput" — самый быстрый. */
  sort?: "price" | "throughput" | "latency";
  /** Желаемый порядок провайдеров. */
  order?: string[];
  /** Разрешить fallback на других провайдеров если order не сработал. */
  allow_fallbacks?: boolean;
  /** Игнорировать перечисленных провайдеров. */
  ignore?: string[];
  /** allow / deny провайдеров что используют промпты для тренировки. */
  data_collection?: "allow" | "deny";
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];

  // generation params
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  seed?: number;
  stop?: string | string[];
  frequency_penalty?: number;
  presence_penalty?: number;

  // structured output
  response_format?: OpenRouterResponseFormat;

  // tools (function calling)
  tools?: unknown[];
  tool_choice?: unknown;

  // OpenRouter-specific
  provider?: OpenRouterProviderRouting;
}

export interface OpenRouterChatChoice {
  index: number;
  finish_reason: string | null;
  message: {
    role: OpenRouterRole;
    content: string | null;
    tool_calls?: unknown[];
  };
}

export interface OpenRouterChatResponse {
  id: string;
  model: string;
  created: number;
  choices: OpenRouterChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    code?: string | number;
    type?: string;
  };
}

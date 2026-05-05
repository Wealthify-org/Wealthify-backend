import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";

import { JwtAuthGuard } from "@gateway/common/guards/jwt-auth.guard";
import { CurrentUser } from "@gateway/common/decorators/сurrent-user.decorator";

import { ChatService } from "./chat.service";
import { ChatCompletionsDto } from "./chat.dto";

/**
 * Превращает технический текст ошибки от OpenRouter / нашего слоя в
 * понятное сообщение для юзера на русском. Сырой message приходит
 * вида `OpenRouter HTTP 429: {"error":...}` или
 * `OpenRouter API error: ...` — это никак нельзя отдавать в UI.
 */
function mapAiErrorToUserMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("429") ||
    m.includes("rate-limit") ||
    m.includes("rate limit") ||
    m.includes("too many requests")
  ) {
    return "Ассистент сейчас перегружен. Попробуйте, пожалуйста, через минуту.";
  }
  if (m.includes("timeout") || m.includes("aborterror")) {
    return "Превышено время ожидания ответа. Попробуйте ещё раз.";
  }
  if (m.includes("401") || m.includes("403") || m.includes("api key")) {
    return "Сервис ассистента временно недоступен. Мы уже знаем о проблеме.";
  }
  if (
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504") ||
    m.includes("upstream") ||
    m.includes("provider returned error")
  ) {
    return "Сервис ассистента временно недоступен. Попробуйте чуть позже.";
  }
  if (m.includes("500") || m.includes("internal server error")) {
    return "Внутренняя ошибка сервера. Попробуйте ещё раз.";
  }
  return "Не удалось получить ответ. Попробуйте ещё раз.";
}

@ApiTags("AI-чат")
@Controller("chat")
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post("completions")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Получить ответ ассистента (SSE-stream)",
    description:
      "Принимает историю сообщений + опциональный contextPortfolioId. " +
      "Отдаёт ответ через Server-Sent Events: каждый chunk — `data: {\"d\":\"<delta>\"}\\n\\n`, " +
      "поток завершается `data: [DONE]\\n\\n`. " +
      "Для типизации ошибки middleware: при ошибке стрим может вернуть `data: {\"error\":\"...\"}\\n\\n` перед DONE.",
  })
  async completions(
    @Body() dto: ChatCompletionsDto,
    @CurrentUser("id") userId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // отключаем буферизацию для nginx-proxy
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const ping = () => {
      // SSE comment-line — keep-alive чтобы прокси не закрывали idle-соединение
      try {
        res.write(": ping\n\n");
      } catch {
        /* noop */
      }
    };
    const pingInterval = setInterval(ping, 15_000);

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    try {
      for await (const delta of this.chatService.streamReply(dto, userId)) {
        if (aborted) break;
        // важно: только сериализуемая дельта
        res.write(`data: ${JSON.stringify({ d: delta })}\n\n`);
      }
      if (!aborted) res.write("data: [DONE]\n\n");
    } catch (e) {
      const rawMsg = (e as Error)?.message ?? "internal error";
      // В лог пишем «сырой» технический текст для дебага. Юзеру отдаём
      // «человеческое» сообщение — без JSON и упоминания внутренней
      // инфраструктуры. Раньше юзер видел красную плашку с
      // `OpenRouter HTTP 429: {"error":...}` — мы это причесываем.
      this.logger.error(`Chat stream failed: ${rawMsg}`);
      const userMsg = mapAiErrorToUserMessage(rawMsg);
      try {
        res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
        res.write("data: [DONE]\n\n");
      } catch {
        /* noop */
      }
    } finally {
      clearInterval(pingInterval);
      try {
        res.end();
      } catch {
        /* noop */
      }
    }
  }

  @Get("history")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Получить недавнюю историю чата текущего пользователя",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Количество последних сообщений (макс 200, по умолчанию 60)",
  })
  @ApiResponse({ status: 200, description: "История в хронологическом порядке" })
  async getHistory(
    @CurrentUser("id") userId: number,
    @Query("limit") limit?: string,
  ) {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 60)) : 60;
    const messages = await this.chatService.getHistory(userId, parsed);
    return { messages };
  }

  @Delete("history")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Удалить всю историю чата текущего пользователя" })
  @ApiResponse({ status: 200, description: "Сколько записей удалено" })
  async clearHistory(@CurrentUser("id") userId: number) {
    return this.chatService.clearHistory(userId);
  }
}

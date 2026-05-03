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
      const msg = (e as Error)?.message ?? "internal error";
      this.logger.error(`Chat stream failed: ${msg}`);
      try {
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
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

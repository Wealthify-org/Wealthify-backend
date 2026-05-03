import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { CHAT_HISTORY_PATTERNS, ChatHistoryRole } from "@libs/contracts";
import { ChatHistoryService } from "./chat-history.service";

@Controller()
export class ChatHistoryController {
  constructor(private readonly service: ChatHistoryService) {}

  @MessagePattern(CHAT_HISTORY_PATTERNS.APPEND)
  append(
    @Payload()
    payload: { userId: number; role: ChatHistoryRole; content: string },
  ) {
    return this.service.append(payload.userId, payload.role, payload.content);
  }

  @MessagePattern(CHAT_HISTORY_PATTERNS.GET_RECENT)
  getRecent(@Payload() payload: { userId: number; limit?: number }) {
    return this.service.getRecent(payload.userId, payload.limit);
  }

  @MessagePattern(CHAT_HISTORY_PATTERNS.CLEAR)
  clear(@Payload() payload: { userId: number }) {
    return this.service.clear(payload.userId);
  }
}

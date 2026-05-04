import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { ChatMessage } from "./chat-message.model";
import { ChatHistoryMessage, ChatHistoryRole } from "@libs/contracts";

const MAX_CONTENT_LENGTH = 4000;
const HISTORY_HARD_LIMIT_PER_USER = 200; // храним максимум 200 последних сообщений на пользователя

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(
    @InjectModel(ChatMessage)
    private readonly repo: typeof ChatMessage,
  ) {}

  async append(
    userId: number,
    role: ChatHistoryRole,
    content: string,
  ): Promise<ChatHistoryMessage> {
    const safeContent = (content ?? "").slice(0, MAX_CONTENT_LENGTH);

    const message = await this.repo.create({ userId, role, content: safeContent });

    // best-effort обрезание истории до HARD_LIMIT — выполняется фоном, не блокируем
    this.trimHistory(userId).catch((e) =>
      this.logger.warn(
        `trimHistory failed for user=${userId}: ${(e as Error)?.message ?? e}`,
      ),
    );

    return this.toDto(message);
  }

  async getRecent(
    userId: number,
    limit = 60,
  ): Promise<ChatHistoryMessage[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit) || 60));
    const rows = await this.repo.findAll({
      where: { userId },
      order: [["id", "DESC"]],
      limit: safeLimit,
    });
    // вернём в хронологическом порядке (старые → новые)
    return rows.reverse().map((m) => this.toDto(m));
  }

  async clear(userId: number): Promise<{ deleted: number }> {
    const deleted = await this.repo.destroy({ where: { userId } });
    return { deleted };
  }

  private async trimHistory(userId: number): Promise<void> {
    // Один запрос вместо count + findAll + destroy:
    //  – находим граничный id (HARD_LIMIT-й с конца) одним SELECT
    //  – удаляем всё, что строго старше этого id
    // Если у юзера ≤ HARD_LIMIT сообщений — boundary не найдётся, и мы выйдем.
    const boundary = await this.repo.findOne({
      where: { userId },
      order: [["id", "DESC"]],
      offset: HISTORY_HARD_LIMIT_PER_USER - 1,
      attributes: ["id"],
    });
    if (!boundary) return;

    await this.repo.destroy({
      where: {
        userId,
        id: { [Op.lt]: boundary.id },
      },
    });
  }

  private toDto(m: ChatMessage): ChatHistoryMessage {
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: (m as unknown as { createdAt: Date }).createdAt.toISOString(),
    };
  }
}

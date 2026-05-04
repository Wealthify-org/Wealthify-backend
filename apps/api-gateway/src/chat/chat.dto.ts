import { z } from "zod";
import { createZodDto } from "nestjs-zod";

const ChatRoleSchema = z.enum(["user", "assistant"]);

const ChatHistoryMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1).max(4000),
});

export const ChatCompletionsSchema = z
  .object({
    /**
     * История сообщений включая последний user-msg.
     * Минимум 1, последний обязательно от user.
     */
    messages: z
      .array(ChatHistoryMessageSchema)
      .min(1)
      .max(40)
      .refine((arr) => arr[arr.length - 1].role === "user", {
        message: "last message must be from user",
      }),

    /**
     * Опциональный id портфеля который пользователь сейчас просматривает.
     * Используется для подгрузки детального контекста.
     */
    contextPortfolioId: z.coerce.number().int().positive().optional(),

    /**
     * Язык, на котором пользователь хочет получать ответы.
     * "ru" — по умолчанию, "en" — английский.
     */
    lang: z.enum(["ru", "en"]).optional(),
  })
  .strict();

export class ChatCompletionsDto extends createZodDto(ChatCompletionsSchema) {}

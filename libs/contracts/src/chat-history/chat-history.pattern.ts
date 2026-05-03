export const CHAT_HISTORY_PATTERNS = {
  APPEND: "chat_history.append",
  GET_RECENT: "chat_history.get_recent",
  CLEAR: "chat_history.clear",
} as const;

export type ChatHistoryRole = "user" | "assistant";

export interface ChatHistoryMessage {
  id: number;
  role: ChatHistoryRole;
  content: string;
  createdAt: string;
}

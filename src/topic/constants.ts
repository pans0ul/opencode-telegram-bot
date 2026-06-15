export type TopicSessionStatus = "active" | "closed" | "abandoned" | "stale";

export interface TopicSessionBinding {
  scopeKey: string;
  chatId: number;
  threadId: number;
  sessionId: string;
  directory: string;
  status: TopicSessionStatus;
  createdAt: number;
  updatedAt: number;
}

export const TOPIC_NAME_MAX_LENGTH = 128;
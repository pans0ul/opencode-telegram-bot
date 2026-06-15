import type { Context } from "grammy";

export type ScopeContextKind = "dm" | "group-general" | "group-topic";

export interface ConversationScope {
  key: string;
  chatId: number;
  threadId: number | null;
  context: ScopeContextKind;
}

export const GENERAL_TOPIC_THREAD_ID = 1;

export function resolveScope(ctx: Context): ConversationScope {
  const chatId = ctx.chat?.id;

  if (!chatId || !ctx.chat) {
    return { key: "dm:0", chatId: 0, threadId: null, context: "dm" };
  }

  const chatType = ctx.chat.type;

  if (chatType === "private" || chatType === "group") {
    return { key: `dm:${ctx.from?.id ?? chatId}`, chatId, threadId: null, context: "dm" };
  }

  if (chatType === "supergroup") {
    const isForum = Reflect.get(ctx.chat, "is_forum") === true;
    const messageThreadId = ctx.msg?.message_thread_id ?? null;

    if (isForum) {
      if (messageThreadId === null || messageThreadId === GENERAL_TOPIC_THREAD_ID) {
        return {
          key: `${chatId}:${GENERAL_TOPIC_THREAD_ID}`,
          chatId,
          threadId: GENERAL_TOPIC_THREAD_ID,
          context: "group-general",
        };
      }
      return {
        key: `${chatId}:${messageThreadId}`,
        chatId,
        threadId: messageThreadId,
        context: "group-topic",
      };
    }

    return { key: `dm:${chatId}`, chatId, threadId: null, context: "dm" };
  }

  return { key: `dm:${chatId}`, chatId, threadId: null, context: "dm" };
}

export function getThreadSendOptions(threadId: number | null): { message_thread_id?: number } {
  if (threadId === null || threadId === GENERAL_TOPIC_THREAD_ID) {
    return {};
  }
  return { message_thread_id: threadId };
}

export function isGroupGeneralControlScope(ctx: Context): boolean {
  const chatType = ctx.chat?.type;
  if (chatType !== "supergroup") {
    return false;
  }

  const isForum = ctx.chat ? Reflect.get(ctx.chat, "is_forum") === true : false;
  if (!isForum) {
    return false;
  }

  const threadId = ctx.msg?.message_thread_id;
  return threadId === undefined || threadId === GENERAL_TOPIC_THREAD_ID || threadId === null;
}

export function isForumTopicScope(ctx: Context): boolean {
  const chatType = ctx.chat?.type;
  if (chatType !== "supergroup") {
    return false;
  }

  const isForum = ctx.chat ? Reflect.get(ctx.chat, "is_forum") === true : false;
  if (!isForum) {
    return false;
  }

  const threadId = ctx.msg?.message_thread_id;
  return threadId !== undefined && threadId !== null && threadId !== GENERAL_TOPIC_THREAD_ID;
}

export function isForumChat(ctx: Context): boolean {
  return ctx.chat?.type === "supergroup" && Reflect.get(ctx.chat as object, "is_forum") === true;
}

export function buildScopeKey(chatId: number, threadId: number | null): string {
  if (threadId === null) {
    return `dm:${chatId}`;
  }
  return `${chatId}:${threadId}`;
}
import { describe, expect, it } from "vitest";
import {
  resolveScope,
  getThreadSendOptions,
  isGroupGeneralControlScope,
  isForumTopicScope,
  isForumChat,
  buildScopeKey,
  GENERAL_TOPIC_THREAD_ID,
  type ConversationScope,
} from "../../src/bot/scope.js";
import type { Context } from "grammy";

function mockCtx(overrides: Partial<Context> = {}): Context {
  return overrides as unknown as Context;
}

describe("bot/scope", () => {
  describe("resolveScope", () => {
    it("resolves DM scope for private chat", () => {
      const ctx = mockCtx({
        chat: { id: 123, type: "private" },
        from: { id: 456, is_bot: false, first_name: "Test" },
        msg: {} as Context["msg"],
      } as unknown as Context);

      const scope = resolveScope(ctx);
      expect(scope.context).toBe("dm");
      expect(scope.chatId).toBe(123);
      expect(scope.threadId).toBeNull();
      expect(scope.key).toBe("dm:456");
    });

    it("resolves DM scope for regular group", () => {
      const ctx = mockCtx({
        chat: { id: -100123, type: "group" },
        from: { id: 456, is_bot: false, first_name: "Test" },
        msg: {} as Context["msg"],
      } as unknown as Context);

      const scope = resolveScope(ctx);
      expect(scope.context).toBe("dm");
      expect(scope.chatId).toBe(-100123);
    });

    it("resolves group-general scope for forum supergroup's General topic", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        from: { id: 456, is_bot: false, first_name: "Test" },
        msg: { message_thread_id: 1 } as Context["msg"],
      } as unknown as Context);

      const scope = resolveScope(ctx);
      expect(scope.context).toBe("group-general");
      expect(scope.chatId).toBe(-100200);
      expect(scope.threadId).toBe(1);
      expect(scope.key).toBe("-100200:1");
    });

    it("resolves group-topic scope for forum supergroup's dedicated topic", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        from: { id: 456, is_bot: false, first_name: "Test" },
        msg: { message_thread_id: 42 } as Context["msg"],
      } as unknown as Context);

      const scope = resolveScope(ctx);
      expect(scope.context).toBe("group-topic");
      expect(scope.chatId).toBe(-100200);
      expect(scope.threadId).toBe(42);
      expect(scope.key).toBe("-100200:42");
    });

    it("resolves group-general scope for forum supergroup with no thread_id", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        from: { id: 456, is_bot: false, first_name: "Test" },
        msg: {} as Context["msg"],
      } as unknown as Context);

      const scope = resolveScope(ctx);
      expect(scope.context).toBe("group-general");
      expect(scope.threadId).toBe(1);
    });

    it("resolves DM scope for non-forum supergroup", () => {
      const ctx = mockCtx({
        chat: { id: -100300, type: "supergroup" },
        from: { id: 456, is_bot: false, first_name: "Test" },
        msg: {} as Context["msg"],
      } as unknown as Context);

      const scope = resolveScope(ctx);
      expect(scope.context).toBe("dm");
    });
  });

  describe("getThreadSendOptions", () => {
    it("returns empty for null thread ID", () => {
      expect(getThreadSendOptions(null)).toEqual({});
    });

    it("returns empty for General topic thread ID", () => {
      expect(getThreadSendOptions(1)).toEqual({});
    });

    it("returns message_thread_id for dedicated topic", () => {
      expect(getThreadSendOptions(42)).toEqual({ message_thread_id: 42 });
    });
  });

  describe("isGroupGeneralControlScope", () => {
    it("returns true for forum supergroup General topic", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        msg: { message_thread_id: 1 } as Context["msg"],
      } as unknown as Context);

      expect(isGroupGeneralControlScope(ctx)).toBe(true);
    });

    it("returns false for dedicated forum topic", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        msg: { message_thread_id: 42 } as Context["msg"],
      } as unknown as Context);

      expect(isGroupGeneralControlScope(ctx)).toBe(false);
    });

    it("returns false for private chat", () => {
      const ctx = mockCtx({
        chat: { id: 123, type: "private" },
        msg: {} as Context["msg"],
      } as unknown as Context);

      expect(isGroupGeneralControlScope(ctx)).toBe(false);
    });
  });

  describe("isForumTopicScope", () => {
    it("returns true for dedicated forum topic", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        msg: { message_thread_id: 42 } as Context["msg"],
      } as unknown as Context);

      expect(isForumTopicScope(ctx)).toBe(true);
    });

    it("returns false for General topic", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
        msg: { message_thread_id: 1 } as Context["msg"],
      } as unknown as Context);

      expect(isForumTopicScope(ctx)).toBe(false);
    });
  });

  describe("isForumChat", () => {
    it("returns true for forum supergroup", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup", is_forum: true },
      } as unknown as Context);

      expect(isForumChat(ctx)).toBe(true);
    });

    it("returns false for non-forum supergroup", () => {
      const ctx = mockCtx({
        chat: { id: -100200, type: "supergroup" },
      } as unknown as Context);

      expect(isForumChat(ctx)).toBe(false);
    });

    it("returns false for private chat", () => {
      const ctx = mockCtx({
        chat: { id: 123, type: "private" },
      } as unknown as Context);

      expect(isForumChat(ctx)).toBe(false);
    });
  });

  describe("buildScopeKey", () => {
    it("builds DM key for null thread ID", () => {
      expect(buildScopeKey(123, null)).toBe("dm:123");
    });

    it("builds group key for thread ID", () => {
      expect(buildScopeKey(-100200, 42)).toBe("-100200:42");
    });

    it("builds General topic key", () => {
      expect(buildScopeKey(-100200, 1)).toBe("-100200:1");
    });
  });

  describe("GENERAL_TOPIC_THREAD_ID", () => {
    it("is 1", () => {
      expect(GENERAL_TOPIC_THREAD_ID).toBe(1);
    });
  });
});
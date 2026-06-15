import { describe, expect, it, beforeEach } from "vitest";
import { topicManager } from "../../src/topic/manager.js";
import type { TopicSessionBinding } from "../../src/topic/constants.js";

describe("topic/manager", () => {
  beforeEach(() => {
    topicManager.clear();
  });

  describe("registerBinding", () => {
    it("registers a new binding", () => {
      const binding = topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      expect(binding.sessionId).toBe("sess-1");
      expect(binding.scopeKey).toBe("-100:42");
      expect(binding.createdAt).toBeGreaterThan(0);
      expect(binding.updatedAt).toBeGreaterThan(0);
    });

    it("replaces existing binding when registering same scope with different session", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const binding = topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-2",
        directory: "/home/user/project",
        status: "active",
      });

      expect(binding.sessionId).toBe("sess-2");
      expect(topicManager.getBindingBySessionId("sess-1")).toBeNull();
      expect(topicManager.getBindingBySessionId("sess-2")).not.toBeNull();
    });

    it("preserves createdAt when updating existing binding", () => {
      const first = topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const originalCreatedAt = first.createdAt;

      const second = topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      expect(second.createdAt).toBe(originalCreatedAt);
    });
  });

  describe("getBinding", () => {
    it("returns binding by chatId and threadId", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const binding = topicManager.getBinding(-100, 42);
      expect(binding).not.toBeNull();
      expect(binding!.sessionId).toBe("sess-1");
    });

    it("returns null for unknown topic", () => {
      expect(topicManager.getBinding(-999, 99)).toBeNull();
    });
  });

  describe("getBindingBySessionId", () => {
    it("returns binding by session ID", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const binding = topicManager.getBindingBySessionId("sess-1");
      expect(binding).not.toBeNull();
      expect(binding!.threadId).toBe(42);
    });

    it("returns null for unknown session", () => {
      expect(topicManager.getBindingBySessionId("unknown")).toBeNull();
    });
  });

  describe("getBindingsByChat", () => {
    it("returns all bindings for a chat", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });
      topicManager.registerBinding({
        scopeKey: "-100:99",
        chatId: -100,
        threadId: 99,
        sessionId: "sess-2",
        directory: "/home/user/project",
        status: "active",
      });
      topicManager.registerBinding({
        scopeKey: "-200:10",
        chatId: -200,
        threadId: 10,
        sessionId: "sess-3",
        directory: "/home/user/other",
        status: "active",
      });

      const bindings = topicManager.getBindingsByChat(-100);
      expect(bindings).toHaveLength(2);
      expect(bindings.map((b) => b.sessionId)).toContain("sess-1");
      expect(bindings.map((b) => b.sessionId)).toContain("sess-2");
    });
  });

  describe("updateBindingStatus", () => {
    it("updates status by chatId and threadId", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const result = topicManager.updateBindingStatus(-100, 42, "closed");
      expect(result).toBe(true);

      const binding = topicManager.getBinding(-100, 42);
      expect(binding!.status).toBe("closed");
    });

    it("updates status by session ID", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const result = topicManager.updateBindingStatusBySessionId("sess-1", "abandoned");
      expect(result).toBe(true);

      const binding = topicManager.getBindingBySessionId("sess-1");
      expect(binding!.status).toBe("abandoned");
    });
  });

  describe("removeBinding", () => {
    it("removes binding by chatId and threadId", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const removed = topicManager.removeBinding(-100, 42);
      expect(removed).not.toBeNull();
      expect(removed!.sessionId).toBe("sess-1");
      expect(topicManager.getBinding(-100, 42)).toBeNull();
      expect(topicManager.getBindingBySessionId("sess-1")).toBeNull();
    });

    it("removes binding by session ID", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const removed = topicManager.removeBindingBySessionId("sess-1");
      expect(removed).not.toBeNull();
      expect(topicManager.getBinding(-100, 42)).toBeNull();
    });
  });

  describe("getSessionRouteTarget", () => {
    it("returns route target for active binding", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });

      const target = topicManager.getSessionRouteTarget("sess-1");
      expect(target).toEqual({ chatId: -100, threadId: 42 });
    });

    it("returns null for closed binding", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });
      topicManager.updateBindingStatus(-100, 42, "closed");

      expect(topicManager.getSessionRouteTarget("sess-1")).toBeNull();
    });

    it("returns null for unknown session", () => {
      expect(topicManager.getSessionRouteTarget("unknown")).toBeNull();
    });
  });

  describe("getAllActiveBindings", () => {
    it("returns only active bindings", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });
      topicManager.registerBinding({
        scopeKey: "-100:99",
        chatId: -100,
        threadId: 99,
        sessionId: "sess-2",
        directory: "/home/user/project",
        status: "closed",
      });

      const active = topicManager.getAllActiveBindings();
      expect(active).toHaveLength(1);
      expect(active[0].sessionId).toBe("sess-1");
    });
  });

  describe("clear", () => {
    it("removes all bindings", () => {
      topicManager.registerBinding({
        scopeKey: "-100:42",
        chatId: -100,
        threadId: 42,
        sessionId: "sess-1",
        directory: "/home/user/project",
        status: "active",
      });
      topicManager.registerBinding({
        scopeKey: "-200:10",
        chatId: -200,
        threadId: 10,
        sessionId: "sess-2",
        directory: "/home/user/other",
        status: "active",
      });

      topicManager.clear();

      expect(topicManager.getBinding(-100, 42)).toBeNull();
      expect(topicManager.getBinding(-200, 10)).toBeNull();
      expect(topicManager.getAllActiveBindings()).toHaveLength(0);
    });
  });
});
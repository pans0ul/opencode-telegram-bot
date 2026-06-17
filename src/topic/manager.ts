import { buildScopeKey, type ConversationScope } from "../bot/scope.js";
import { setTopicBinding, clearTopicBinding } from "../settings/manager.js";
import { logger } from "../utils/logger.js";
import type { TopicSessionBinding, TopicSessionStatus } from "./constants.js";

class TopicManager {
  private bindingsByScope = new Map<string, TopicSessionBinding>();
  private bindingsBySession = new Map<string, TopicSessionBinding>();
  private sessionToScope = new Map<string, string>();

  registerBinding(input: Omit<TopicSessionBinding, "createdAt" | "updatedAt">): TopicSessionBinding {
    const scopeKey = buildScopeKey(input.chatId, input.threadId);
    const existing = this.bindingsByScope.get(scopeKey);
    if (existing && existing.sessionId === input.sessionId) {
      existing.updatedAt = Date.now();
      return existing;
    }
    if (existing && existing.sessionId !== input.sessionId) {
      this.bindingsBySession.delete(existing.sessionId);
      this.sessionToScope.delete(existing.sessionId);
    }

    const binding: TopicSessionBinding = {
      ...input,
      scopeKey,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    this.bindingsByScope.set(scopeKey, binding);
    this.bindingsBySession.set(input.sessionId, binding);
    this.sessionToScope.set(input.sessionId, scopeKey);

    setTopicBinding(input.chatId, input.threadId, binding);

    logger.info(
      `[TopicManager] Registered binding: scope=${scopeKey}, session=${input.sessionId}, directory=${input.directory}`,
    );

    return binding;
  }

  getBinding(chatId: number, threadId: number): TopicSessionBinding | null {
    const scopeKey = buildScopeKey(chatId, threadId);
    return this.bindingsByScope.get(scopeKey) ?? null;
  }

  getBindingBySessionId(sessionId: string): TopicSessionBinding | null {
    return this.bindingsBySession.get(sessionId) ?? null;
  }

  getBindingByScope(scopeKey: string): TopicSessionBinding | null {
    return this.bindingsByScope.get(scopeKey) ?? null;
  }

  getBindingsByChat(chatId: number): TopicSessionBinding[] {
    const prefix = `${chatId}:`;
    const result: TopicSessionBinding[] = [];
    for (const [key, binding] of this.bindingsByScope) {
      if (key.startsWith(prefix)) {
        result.push(binding);
      }
    }
    return result;
  }

  updateBindingStatus(chatId: number, threadId: number, status: TopicSessionStatus): boolean {
    const scopeKey = buildScopeKey(chatId, threadId);
    const binding = this.bindingsByScope.get(scopeKey);
    if (!binding) {
      return false;
    }
    binding.status = status;
    binding.updatedAt = Date.now();
    return true;
  }

  updateBindingStatusBySessionId(sessionId: string, status: TopicSessionStatus): boolean {
    const binding = this.bindingsBySession.get(sessionId);
    if (!binding) {
      return false;
    }
    binding.status = status;
    binding.updatedAt = Date.now();
    return true;
  }

  removeBinding(chatId: number, threadId: number): TopicSessionBinding | null {
    const scopeKey = buildScopeKey(chatId, threadId);
    const binding = this.bindingsByScope.get(scopeKey);
    if (!binding) {
      return null;
    }

    this.bindingsByScope.delete(scopeKey);
    this.bindingsBySession.delete(binding.sessionId);
    this.sessionToScope.delete(binding.sessionId);

    clearTopicBinding(chatId, threadId);

    logger.info(
      `[TopicManager] Removed binding: scope=${scopeKey}, session=${binding.sessionId}`,
    );

    return binding;
  }

  removeBindingBySessionId(sessionId: string): TopicSessionBinding | null {
    const binding = this.bindingsBySession.get(sessionId);
    if (!binding) {
      return null;
    }
    return this.removeBinding(binding.chatId, binding.threadId);
  }

  getSessionRouteTarget(sessionId: string): { chatId: number; threadId: number | null } | null {
    const binding = this.bindingsBySession.get(sessionId);
    if (!binding) {
      return null;
    }
    if (binding.status !== "active") {
      return null;
    }
    return { chatId: binding.chatId, threadId: binding.threadId };
  }

  getScopeForSession(sessionId: string): ConversationScope | null {
    const scopeKey = this.sessionToScope.get(sessionId);
    if (!scopeKey) {
      return null;
    }
    const binding = this.bindingsByScope.get(scopeKey);
    if (!binding) {
      return null;
    }
    return {
      key: scopeKey,
      chatId: binding.chatId,
      threadId: binding.threadId,
      context: binding.threadId ? "group-topic" : "dm",
    };
  }

  getAllActiveBindings(): TopicSessionBinding[] {
    const result: TopicSessionBinding[] = [];
    for (const binding of this.bindingsByScope.values()) {
      if (binding.status === "active") {
        result.push(binding);
      }
    }
    return result;
  }

  clear(): void {
    for (const binding of this.bindingsByScope.values()) {
      clearTopicBinding(binding.chatId, binding.threadId);
    }
    this.bindingsByScope.clear();
    this.bindingsBySession.clear();
    this.sessionToScope.clear();
  }

  getAllBindings(): TopicSessionBinding[] {
    return [...this.bindingsByScope.values()];
  }
}

export const topicManager = new TopicManager();
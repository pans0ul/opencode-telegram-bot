import type { ModelInfo } from "../model/types.js";
import { cloneScheduledTask, type ScheduledTask } from "../scheduled-task/types.js";
import path from "node:path";
import { getRuntimePaths } from "../runtime/paths.js";
import { logger } from "../utils/logger.js";
import type { TopicSessionBinding } from "../topic/constants.js";

export interface ProjectInfo {
  id: string;
  worktree: string;
  name?: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  directory: string;
}

export interface SessionDirectoryCacheInfo {
  version: 1;
  lastSyncedUpdatedAt: number;
  directories: Array<{
    worktree: string;
    lastUpdated: number;
  }>;
}

export interface ScheduledTaskSessionIgnoreInfo {
  sessionId: string;
  createdAt: string;
}

export interface ScopeSettings {
  currentProject?: ProjectInfo;
  currentSession?: SessionInfo;
  currentAgent?: string;
  currentModel?: ModelInfo;
  pinnedMessageId?: number;
  ttsEnabled?: boolean;
}

export interface TopicSettings extends ScopeSettings {
  binding?: TopicSessionBinding;
}

export interface GroupSettings {
  general: ScopeSettings;
  topics: Record<string, TopicSettings>;
}

export interface Settings {
  currentProject?: ProjectInfo;
  currentSession?: SessionInfo;
  currentAgent?: string;
  currentModel?: ModelInfo;
  pinnedMessageId?: number;
  ttsEnabled?: boolean;
  sessionDirectoryCache?: SessionDirectoryCacheInfo;
  scheduledTasks?: ScheduledTask[];
  scheduledTaskSessionIgnores?: ScheduledTaskSessionIgnoreInfo[];
  groups?: Record<string, GroupSettings>;
}

function cloneScheduledTasks(tasks: ScheduledTask[] | undefined): ScheduledTask[] | undefined {
  return tasks?.map((task) => cloneScheduledTask(task));
}

function cloneScheduledTaskSessionIgnores(
  ignores: ScheduledTaskSessionIgnoreInfo[] | undefined,
): ScheduledTaskSessionIgnoreInfo[] | undefined {
  return ignores?.map((ignore) => ({ ...ignore }));
}

function getSettingsFilePath(): string {
  return getRuntimePaths().settingsFilePath;
}

async function readSettingsFile(): Promise<Settings> {
  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(getSettingsFilePath(), "utf-8");
    return JSON.parse(content) as Settings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("[SettingsManager] Error reading settings file:", error);
    }
    return {};
  }
}

let settingsWriteQueue: Promise<void> = Promise.resolve();

function writeSettingsFile(settings: Settings): Promise<void> {
  settingsWriteQueue = settingsWriteQueue
    .catch(() => {
      // Keep write queue alive after failed writes.
    })
    .then(async () => {
      try {
        const fs = await import("fs/promises");
        const settingsFilePath = getSettingsFilePath();
        await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
      } catch (err) {
        logger.error("[SettingsManager] Error writing settings file:", err);
      }
    });

  return settingsWriteQueue;
}

let currentSettings: Settings = {};

export function getCurrentProject(): ProjectInfo | undefined {
  return currentSettings.currentProject;
}

export function setCurrentProject(projectInfo: ProjectInfo): void {
  currentSettings.currentProject = projectInfo;
  void writeSettingsFile(currentSettings);
}

export function clearProject(): void {
  currentSettings.currentProject = undefined;
  void writeSettingsFile(currentSettings);
}

export function getCurrentSession(): SessionInfo | undefined {
  return currentSettings.currentSession;
}

export function setCurrentSession(sessionInfo: SessionInfo): void {
  currentSettings.currentSession = sessionInfo;
  void writeSettingsFile(currentSettings);
}

export function clearSession(): void {
  currentSettings.currentSession = undefined;
  void writeSettingsFile(currentSettings);
}

export function isTtsEnabled(): boolean {
  return currentSettings.ttsEnabled === true;
}

export function setTtsEnabled(enabled: boolean): void {
  currentSettings.ttsEnabled = enabled;
  void writeSettingsFile(currentSettings);
}

export function getCurrentAgent(): string | undefined {
  return currentSettings.currentAgent;
}

export function setCurrentAgent(agentName: string): void {
  currentSettings.currentAgent = agentName;
  void writeSettingsFile(currentSettings);
}

export function clearCurrentAgent(): void {
  currentSettings.currentAgent = undefined;
  void writeSettingsFile(currentSettings);
}

export function getCurrentModel(): ModelInfo | undefined {
  return currentSettings.currentModel;
}

export function setCurrentModel(modelInfo: ModelInfo): void {
  currentSettings.currentModel = modelInfo;
  void writeSettingsFile(currentSettings);
}

export function clearCurrentModel(): void {
  currentSettings.currentModel = undefined;
  void writeSettingsFile(currentSettings);
}

export function getPinnedMessageId(): number | undefined {
  return currentSettings.pinnedMessageId;
}

export function setPinnedMessageId(messageId: number): void {
  currentSettings.pinnedMessageId = messageId;
  void writeSettingsFile(currentSettings);
}

export function clearPinnedMessageId(): void {
  currentSettings.pinnedMessageId = undefined;
  void writeSettingsFile(currentSettings);
}

export function getSessionDirectoryCache(): SessionDirectoryCacheInfo | undefined {
  return currentSettings.sessionDirectoryCache;
}

export function setSessionDirectoryCache(cache: SessionDirectoryCacheInfo): Promise<void> {
  currentSettings.sessionDirectoryCache = cache;
  return writeSettingsFile(currentSettings);
}

export function clearSessionDirectoryCache(): void {
  currentSettings.sessionDirectoryCache = undefined;
  void writeSettingsFile(currentSettings);
}

export function getScheduledTasks(): ScheduledTask[] {
  return cloneScheduledTasks(currentSettings.scheduledTasks) ?? [];
}

export function setScheduledTasks(tasks: ScheduledTask[]): Promise<void> {
  currentSettings.scheduledTasks = cloneScheduledTasks(tasks);
  return writeSettingsFile(currentSettings);
}

export function getScheduledTaskSessionIgnores(): ScheduledTaskSessionIgnoreInfo[] {
  return cloneScheduledTaskSessionIgnores(currentSettings.scheduledTaskSessionIgnores) ?? [];
}

export function setScheduledTaskSessionIgnores(
  ignores: ScheduledTaskSessionIgnoreInfo[],
): Promise<void> {
  currentSettings.scheduledTaskSessionIgnores = cloneScheduledTaskSessionIgnores(ignores);
  return writeSettingsFile(currentSettings);
}

export function __resetSettingsForTests(): void {
  currentSettings = {};
  settingsWriteQueue = Promise.resolve();
}

function ensureGroupSettings(chatId: number): GroupSettings {
  const chatKey = String(chatId);
  if (!currentSettings.groups) {
    currentSettings.groups = {};
  }
  if (!currentSettings.groups[chatKey]) {
    currentSettings.groups[chatKey] = { general: {}, topics: {} };
  }
  return currentSettings.groups[chatKey];
}

function ensureTopicSettings(chatId: number, threadId: number): TopicSettings {
  const group = ensureGroupSettings(chatId);
  const topicKey = String(threadId);
  if (!group.topics[topicKey]) {
    group.topics[topicKey] = {};
  }
  return group.topics[topicKey];
}

function resolveScopeStore(scopeKey: string): ScopeSettings | null {
  if (!currentSettings.groups) {
    return null;
  }

  if (scopeKey.startsWith("dm:")) {
    return currentSettings;
  }

  const colonIdx = scopeKey.indexOf(":");
  if (colonIdx === -1) {
    return null;
  }

  const chatId = scopeKey.slice(0, colonIdx);
  const threadId = scopeKey.slice(colonIdx + 1);

  const group = currentSettings.groups[chatId];
  if (!group) {
    return null;
  }

  if (threadId === "1") {
    return group.general;
  }

  return group.topics[threadId] ?? null;
}

function getOrCreateScopeStore(scopeKey: string): ScopeSettings {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings;
  }

  const colonIdx = scopeKey.indexOf(":");
  if (colonIdx === -1) {
    return currentSettings;
  }

  const chatId = Number(scopeKey.slice(0, colonIdx));
  const threadId = scopeKey.slice(colonIdx + 1);

  if (threadId === "1") {
    return ensureGroupSettings(chatId).general;
  }

  return ensureTopicSettings(chatId, Number(threadId));
}

export function getScopedSession(scopeKey: string): SessionInfo | undefined {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings.currentSession;
  }
  const store = resolveScopeStore(scopeKey);
  return store?.currentSession;
}

export function setScopedSession(scopeKey: string, sessionInfo: SessionInfo): void {
  const store = getOrCreateScopeStore(scopeKey);
  store.currentSession = sessionInfo;
  if (scopeKey.startsWith("dm:")) {
    currentSettings.currentSession = sessionInfo;
  }
  void writeSettingsFile(currentSettings);
}

export function clearScopedSession(scopeKey: string): void {
  if (scopeKey.startsWith("dm:")) {
    currentSettings.currentSession = undefined;
    void writeSettingsFile(currentSettings);
    return;
  }
  const store = resolveScopeStore(scopeKey);
  if (store) {
    store.currentSession = undefined;
    void writeSettingsFile(currentSettings);
  }
}

export function getScopedProject(scopeKey: string): ProjectInfo | undefined {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings.currentProject;
  }
  const store = resolveScopeStore(scopeKey);
  return store?.currentProject;
}

export function setScopedProject(scopeKey: string, projectInfo: ProjectInfo): void {
  const store = getOrCreateScopeStore(scopeKey);
  store.currentProject = projectInfo;
  if (scopeKey.startsWith("dm:")) {
    currentSettings.currentProject = projectInfo;
  }
  void writeSettingsFile(currentSettings);
}

export function clearScopedProject(scopeKey: string): void {
  if (scopeKey.startsWith("dm:")) {
    currentSettings.currentProject = undefined;
    void writeSettingsFile(currentSettings);
    return;
  }
  const store = resolveScopeStore(scopeKey);
  if (store) {
    store.currentProject = undefined;
    void writeSettingsFile(currentSettings);
  }
}

export function getScopedAgent(scopeKey: string): string | undefined {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings.currentAgent;
  }
  const store = resolveScopeStore(scopeKey);
  return store?.currentAgent;
}

export function setScopedAgent(scopeKey: string, agentName: string): void {
  const store = getOrCreateScopeStore(scopeKey);
  store.currentAgent = agentName;
  if (scopeKey.startsWith("dm:")) {
    currentSettings.currentAgent = agentName;
  }
  void writeSettingsFile(currentSettings);
}

export function getScopedModel(scopeKey: string): ModelInfo | undefined {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings.currentModel;
  }
  const store = resolveScopeStore(scopeKey);
  return store?.currentModel;
}

export function setScopedModel(scopeKey: string, modelInfo: ModelInfo): void {
  const store = getOrCreateScopeStore(scopeKey);
  store.currentModel = modelInfo;
  if (scopeKey.startsWith("dm:")) {
    currentSettings.currentModel = modelInfo;
  }
  void writeSettingsFile(currentSettings);
}

export function getScopedPinnedMessageId(scopeKey: string): number | undefined {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings.pinnedMessageId;
  }
  const store = resolveScopeStore(scopeKey);
  return store?.pinnedMessageId;
}

export function setScopedPinnedMessageId(scopeKey: string, messageId: number): void {
  const store = getOrCreateScopeStore(scopeKey);
  store.pinnedMessageId = messageId;
  if (scopeKey.startsWith("dm:")) {
    currentSettings.pinnedMessageId = messageId;
  }
  void writeSettingsFile(currentSettings);
}

export function clearScopedPinnedMessageId(scopeKey: string): void {
  if (scopeKey.startsWith("dm:")) {
    currentSettings.pinnedMessageId = undefined;
    void writeSettingsFile(currentSettings);
    return;
  }
  const store = resolveScopeStore(scopeKey);
  if (store) {
    store.pinnedMessageId = undefined;
    void writeSettingsFile(currentSettings);
  }
}

export function getScopedTtsEnabled(scopeKey: string): boolean {
  if (scopeKey.startsWith("dm:")) {
    return currentSettings.ttsEnabled === true;
  }
  const store = resolveScopeStore(scopeKey);
  return store?.ttsEnabled === true;
}

export function setScopedTtsEnabled(scopeKey: string, enabled: boolean): void {
  const store = getOrCreateScopeStore(scopeKey);
  store.ttsEnabled = enabled;
  if (scopeKey.startsWith("dm:")) {
    currentSettings.ttsEnabled = enabled;
  }
  void writeSettingsFile(currentSettings);
}

export function getTopicBinding(chatId: number, threadId: number): TopicSessionBinding | undefined {
  if (!currentSettings.groups) {
    return undefined;
  }
  const chatKey = String(chatId);
  const group = currentSettings.groups[chatKey];
  if (!group) {
    return undefined;
  }
  const topicKey = String(threadId);
  const topic = group.topics[topicKey];
  return topic?.binding;
}

export function setTopicBinding(chatId: number, threadId: number, binding: TopicSessionBinding): void {
  const topic = ensureTopicSettings(chatId, threadId);
  topic.binding = binding;
  void writeSettingsFile(currentSettings);
}

export function clearTopicBinding(chatId: number, threadId: number): void {
  if (!currentSettings.groups) {
    return;
  }
  const chatKey = String(chatId);
  const group = currentSettings.groups[chatKey];
  if (!group) {
    return;
  }
  const topicKey = String(threadId);
  const topic = group.topics[topicKey];
  if (topic) {
    topic.binding = undefined;
    void writeSettingsFile(currentSettings);
  }
}

export function loadAllTopicBindings(): Array<TopicSessionBinding & { chatId: number; threadId: number }> {
  if (!currentSettings.groups) {
    return [];
  }
  const result: Array<TopicSessionBinding & { chatId: number; threadId: number }> = [];
  for (const [chatKey, group] of Object.entries(currentSettings.groups)) {
    for (const [topicKey, topic] of Object.entries(group.topics)) {
      if (topic.binding) {
        result.push({
          ...topic.binding,
          chatId: Number(chatKey),
          threadId: Number(topicKey),
        });
      }
    }
  }
  return result;
}

export async function loadSettings(): Promise<void> {
  const loadedSettings = (await readSettingsFile()) as Settings & {
    serverProcess?: unknown;
    toolMessagesIntervalSec?: unknown;
  };

  let requiresRewrite = false;

  if ("toolMessagesIntervalSec" in loadedSettings) {
    delete loadedSettings.toolMessagesIntervalSec;
    requiresRewrite = true;
  }

  if ("serverProcess" in loadedSettings) {
    delete loadedSettings.serverProcess;
    requiresRewrite = true;
  }

  currentSettings = loadedSettings;
  currentSettings.scheduledTasks = cloneScheduledTasks(loadedSettings.scheduledTasks) ?? [];
  currentSettings.scheduledTaskSessionIgnores =
    cloneScheduledTaskSessionIgnores(loadedSettings.scheduledTaskSessionIgnores) ?? [];

  if (requiresRewrite) {
    void writeSettingsFile(currentSettings);
  }
}

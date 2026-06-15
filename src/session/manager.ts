import {
  getCurrentSession as getSettingsSession,
  setCurrentSession as setSettingsSession,
  clearSession as clearSettingsSession,
  getScopedSession,
  setScopedSession,
  clearScopedSession,
  SessionInfo,
} from "../settings/manager.js";

export type { SessionInfo };

export function setCurrentSession(sessionInfo: SessionInfo, scopeKey?: string): void {
  if (scopeKey) {
    setScopedSession(scopeKey, sessionInfo);
  } else {
    setSettingsSession(sessionInfo);
  }
}

export function getCurrentSession(scopeKey?: string): SessionInfo | null {
  if (scopeKey) {
    return getScopedSession(scopeKey) ?? null;
  }
  return getSettingsSession() ?? null;
}

export function clearSession(scopeKey?: string): void {
  if (scopeKey) {
    clearScopedSession(scopeKey);
  } else {
    clearSettingsSession();
  }
}
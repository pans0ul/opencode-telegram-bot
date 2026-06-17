import { TOPIC_NAME_MAX_LENGTH } from "./constants.js";

export function formatTopicTitle(title: string, sessionId?: string): string {
  const idPart = sessionId ? ` [${sessionId.slice(0, 8)}]` : "";
  const full = `${title}${idPart}`;
  if (full.length <= TOPIC_NAME_MAX_LENGTH) {
    return full;
  }
  const maxTitleLen = TOPIC_NAME_MAX_LENGTH - idPart.length - 1;
  return title.slice(0, maxTitleLen) + "…" + idPart;
}

const SESSION_ID_IN_TITLE_REGEX = /\[([a-zA-Z0-9_-]{8,})\]$/;

export function parseSessionFromTitle(topicTitle: string): string | null {
  const match = topicTitle.match(SESSION_ID_IN_TITLE_REGEX);
  return match?.[1] ?? null;
}
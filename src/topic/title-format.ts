import { TOPIC_NAME_MAX_LENGTH } from "./constants.js";

export function formatTopicTitle(title: string): string {
  if (title.length <= TOPIC_NAME_MAX_LENGTH) {
    return title;
  }
  return title.slice(0, TOPIC_NAME_MAX_LENGTH - 1) + "…";
}
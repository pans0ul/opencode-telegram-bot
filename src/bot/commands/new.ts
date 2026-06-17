import type { Bot } from "grammy";
import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { setCurrentSession, SessionInfo } from "../../session/manager.js";
import { ingestSessionInfoForCache } from "../../session/cache-manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { clearAllInteractionState } from "../../interaction/cleanup.js";
import { keyboardManager } from "../../keyboard/manager.js";
import { getStoredAgent, resolveProjectAgent } from "../../agent/manager.js";
import { getStoredModel } from "../../model/manager.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { createMainKeyboard } from "../utils/keyboard.js";
import { isForegroundBusy, replyBusyBlocked } from "../utils/busy-guard.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { attachToSession } from "../../attach/service.js";
import { isForumChat } from "../scope.js";
import { topicManager } from "../../topic/manager.js";
import { formatTopicTitle } from "../../topic/title-format.js";

export interface NewCommandDeps {
  bot: Bot<Context>;
  ensureEventSubscription: (directory: string) => Promise<void>;
}

export async function newCommand(ctx: CommandContext<Context>, deps: NewCommandDeps) {
  try {
    if (isForegroundBusy()) {
      await replyBlocked(ctx);
      return;
    }

    const currentProject = getCurrentProject();

    if (!currentProject) {
      await ctx.reply(t("new.project_not_selected"));
      return;
    }

    const isInForum = isForumChat(ctx);

    logger.debug(
      `[Bot] Creating new session for directory: ${currentProject.worktree}, forum: ${isInForum}`,
    );

    const { data: session, error } = await opencodeClient.session.create({
      directory: currentProject.worktree,
    });

    if (error || !session) {
      throw error || new Error("No data received from server");
    }

    logger.info(
      `[Bot] Created new session via /new command: id=${session.id}, title="${session.title}", project=${currentProject.worktree}`,
    );

    const sessionInfo: SessionInfo = {
      id: session.id,
      title: session.title,
      directory: currentProject.worktree,
    };

    if (isInForum && ctx.chat) {
      await handleForumNewSession(ctx, deps, sessionInfo);
    } else {
      await handleDmNewSession(ctx, deps, sessionInfo);
    }
  } catch (error) {
    logger.error("[Bot] Error creating session:", error);
    await ctx.reply(t("new.create_error"));
  }
}

async function handleForumNewSession(
  ctx: CommandContext<Context>,
  deps: NewCommandDeps,
  sessionInfo: SessionInfo,
) {
  const chatId = ctx.chat!.id;
  const sessionTitle = sessionInfo.title || `Session ${sessionInfo.id.slice(0, 8)}`;
  const topicTitle = formatTopicTitle(sessionTitle, sessionInfo.id);

  let threadId: number;

  try {
    const topicResult = await ctx.api.createForumTopic(chatId, topicTitle);
    threadId = topicResult.message_thread_id;
    logger.info(`[Bot] Created forum topic: "${topicTitle}" (threadId=${threadId})`);
  } catch (err) {
    logger.error("[Bot] Failed to create forum topic:", err);
    await ctx.reply(t("topic.create_error", { error: err instanceof Error ? err.message : String(err) }));
    setCurrentSession(sessionInfo);
    await handleDmNewSession(ctx, deps, sessionInfo);
    return;
  }

  topicManager.registerBinding({
    scopeKey: `${chatId}:${threadId}`,
    chatId,
    threadId,
    sessionId: sessionInfo.id,
    directory: sessionInfo.directory,
    status: "active",
  });

  setCurrentSession(sessionInfo);
  clearAllInteractionState("session_created");
  await ingestSessionInfoForCache(sessionInfo);

  await attachToSession({
    bot: deps.bot,
    chatId,
    session: sessionInfo,
    ensureEventSubscription: deps.ensureEventSubscription,
    messageThreadId: threadId,
  });

  const currentAgent = await resolveProjectAgent(getStoredAgent());
  const currentModel = getStoredModel();
  keyboardManager.updateAgent(currentAgent);
  const contextInfo = keyboardManager.getContextInfo();
  const variantName = formatVariantForButton(currentModel.variant || "default");
  const keyboard = createMainKeyboard(
    currentAgent,
    currentModel,
    contextInfo ?? undefined,
    variantName,
  );

  await deps.bot.api.sendMessage(
    chatId,
    t("topic.created", { title: sessionTitle }),
    {
      message_thread_id: threadId,
      reply_markup: keyboard,
    },
  );
}

async function handleDmNewSession(
  ctx: CommandContext<Context>,
  deps: NewCommandDeps,
  sessionInfo: SessionInfo,
) {
  setCurrentSession(sessionInfo);
  clearAllInteractionState("session_created");
  await ingestSessionInfoForCache(sessionInfo);

  await attachToSession({
    bot: deps.bot,
    chatId: ctx.chat!.id,
    session: sessionInfo,
    ensureEventSubscription: deps.ensureEventSubscription,
  });

  const currentAgent = await resolveProjectAgent(getStoredAgent());
  const currentModel = getStoredModel();
  keyboardManager.updateAgent(currentAgent);
  const contextInfo = keyboardManager.getContextInfo();
  const variantName = formatVariantForButton(currentModel.variant || "default");
  const keyboard = createMainKeyboard(
    currentAgent,
    currentModel,
    contextInfo ?? undefined,
    variantName,
  );

  await ctx.reply(t("new.created", { title: sessionInfo.title }), {
    reply_markup: keyboard,
  });
}

function replyBlocked(ctx: CommandContext<Context>) {
  return replyBusyBlocked(ctx);
}
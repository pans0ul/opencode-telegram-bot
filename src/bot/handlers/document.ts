import type { Context } from "grammy";
import { config } from "../../config.js";
import { processUserPrompt, type ProcessPromptDeps } from "./prompt.js";
import {
  downloadTelegramFile,
  toDataUri,
  isTextMimeType,
  isFileSizeAllowed,
} from "../utils/file-download.js";
import { saveFileToWorkspace } from "../utils/workspace.js";
import { getModelCapabilities, supportsInput } from "../../model/capabilities.js";
import { getStoredModel } from "../../model/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import type { FilePartInput, Model } from "@opencode-ai/sdk/v2";

export interface DocumentHandlerDeps extends ProcessPromptDeps {
  downloadFile?: (
    api: Context["api"],
    fileId: string,
  ) => Promise<{ buffer: Buffer; filePath: string }>;
  getModelCapabilities?: (
    providerId: string,
    modelId: string,
  ) => Promise<Model["capabilities"] | null>;
  getStoredModel?: () => { providerID: string; modelID: string };
  processPrompt?: (
    ctx: Context,
    text: string,
    deps: ProcessPromptDeps,
    fileParts?: FilePartInput[],
  ) => Promise<boolean>;
  saveFileToWorkspace?: (
    filename: string,
    buffer: Buffer,
  ) => Promise<string | null>;
}

function buildPromptWithPath(baseText: string, savedPath: string | null): string {
  if (!savedPath) {
    return baseText;
  }

  const pathInfo = `[File saved at: ${savedPath}]`;
  return baseText.trim() ? `${baseText}\n\n${pathInfo}` : pathInfo;
}

export async function handleDocumentMessage(
  ctx: Context,
  deps: DocumentHandlerDeps,
): Promise<void> {
  const downloadFile = deps.downloadFile ?? downloadTelegramFile;
  const getCapabilities = deps.getModelCapabilities ?? getModelCapabilities;
  const getStored = deps.getStoredModel ?? getStoredModel;
  const processPrompt = deps.processPrompt ?? processUserPrompt;
  const saveFile = deps.saveFileToWorkspace ?? saveFileToWorkspace;

  const doc = ctx.message?.document;
  if (!doc) {
    return;
  }

  const caption = ctx.message.caption || "";
  const mimeType = doc.mime_type || "";
  const filename = doc.file_name || "document";

  try {
    if (isTextMimeType(mimeType)) {
      if (!isFileSizeAllowed(doc.file_size, config.files.maxFileSizeKb)) {
        logger.warn(
          `[Document] Text file too large: ${filename} (${doc.file_size} bytes > ${config.files.maxFileSizeKb}KB)`,
        );
        await ctx.reply(
          t("bot.text_file_too_large", { maxSizeKb: String(config.files.maxFileSizeKb) }),
        );
        return;
      }

      await ctx.reply(t("bot.file_downloading"));
      const downloadedFile = await downloadFile(ctx.api, doc.file_id);
      const savedPath = await saveFile(filename, downloadedFile.buffer);

      const textContent = downloadedFile.buffer.toString("utf-8");
      const promptWithFile = buildPromptWithPath(
        `--- Content of ${filename} ---\n${textContent}\n--- End of file ---\n\n${caption}`,
        savedPath,
      );

      logger.info(
        `[Document] Sending text file (${downloadedFile.buffer.length} bytes, ${filename}) as prompt`,
      );

      await processPrompt(ctx, promptWithFile, deps);
      return;
    }

    if (mimeType.startsWith("image/")) {
      const storedModel = getStored();
      const capabilities = await getCapabilities(storedModel.providerID, storedModel.modelID);

      await ctx.reply(t("bot.file_downloading"));
      const downloadedFile = await downloadFile(ctx.api, doc.file_id);
      const savedPath = await saveFile(filename, downloadedFile.buffer);

      const fileParts: FilePartInput[] = [];

      if (supportsInput(capabilities, "image")) {
        const dataUri = toDataUri(downloadedFile.buffer, mimeType);
        fileParts.push({
          type: "file",
          mime: mimeType,
          filename: filename,
          url: dataUri,
        });
        logger.info(
          `[Document] Sending image (${downloadedFile.buffer.length} bytes, ${filename}, ${mimeType}) with prompt`,
        );
      } else {
        logger.warn(
          `[Document] Model ${storedModel.providerID}/${storedModel.modelID} doesn't support image input, sending path only`,
        );
      }

      const promptText = buildPromptWithPath(caption, savedPath);
      if (!promptText && fileParts.length === 0) {
        await ctx.reply(t("bot.photo_no_caption"));
        return;
      }

      await processPrompt(ctx, promptText, deps, fileParts.length > 0 ? fileParts : undefined);
      return;
    }

    if (mimeType === "application/pdf") {
      const storedModel = getStored();
      const capabilities = await getCapabilities(storedModel.providerID, storedModel.modelID);

      await ctx.reply(t("bot.file_downloading"));
      const downloadedFile = await downloadFile(ctx.api, doc.file_id);
      const savedPath = await saveFile(filename, downloadedFile.buffer);

      const fileParts: FilePartInput[] = [];

      if (supportsInput(capabilities, "pdf")) {
        const dataUri = toDataUri(downloadedFile.buffer, mimeType);
        fileParts.push({
          type: "file",
          mime: mimeType,
          filename: filename,
          url: dataUri,
        });
        logger.info(
          `[Document] Sending PDF (${downloadedFile.buffer.length} bytes, ${filename}) with prompt`,
        );
      } else {
        logger.warn(
          `[Document] Model ${storedModel.providerID}/${storedModel.modelID} doesn't support PDF input, sending path only`,
        );
      }

      const promptText = buildPromptWithPath(caption, savedPath);
      if (!promptText && fileParts.length === 0) {
        await ctx.reply(t("bot.photo_no_caption"));
        return;
      }

      await processPrompt(ctx, promptText, deps, fileParts.length > 0 ? fileParts : undefined);
      return;
    }

    if (mimeType.startsWith("audio/")) {
      await ctx.reply(t("bot.file_downloading"));
      const downloadedFile = await downloadFile(ctx.api, doc.file_id);
      const savedPath = await saveFile(filename, downloadedFile.buffer);

      const storedModel = getStored();
      const capabilities = await getCapabilities(storedModel.providerID, storedModel.modelID);
      const fileParts: FilePartInput[] = [];

      if (supportsInput(capabilities, "audio")) {
        const dataUri = toDataUri(downloadedFile.buffer, mimeType);
        fileParts.push({
          type: "file",
          mime: mimeType,
          filename: filename,
          url: dataUri,
        });
        logger.info(
          `[Document] Sending audio (${downloadedFile.buffer.length} bytes, ${filename}) with prompt`,
        );
      } else {
        logger.info(
          `[Document] Model ${storedModel.providerID}/${storedModel.modelID} doesn't support audio input, sending path only`,
        );
      }

      const promptText = buildPromptWithPath(caption, savedPath);
      if (!promptText && fileParts.length === 0) {
        await ctx.reply(t("bot.photo_no_caption"));
        return;
      }

      await processPrompt(ctx, promptText, deps, fileParts.length > 0 ? fileParts : undefined);
      return;
    }

    logger.warn(`[Document] Unsupported document MIME type: ${mimeType}, filename=${filename}`);
    await ctx.reply(t("bot.file_type_unsupported"));
  } catch (err) {
    logger.error("[Document] Error handling document message:", err);
    await ctx.reply(t("bot.file_download_error"));
  }
}

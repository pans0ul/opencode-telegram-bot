import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import {
  handleDocumentMessage,
  type DocumentHandlerDeps,
} from "../../../src/bot/handlers/document.js";
import { t } from "../../../src/i18n/index.js";

function createDocumentContext(overrides: Partial<Context["message"]> = {}): {
  ctx: Context;
  replyMock: ReturnType<typeof vi.fn>;
} {
  const replyMock = vi.fn().mockResolvedValue({ message_id: 101 });

  const ctx = {
    chat: { id: 777 },
    message: {
      document: {
        file_id: "doc-file-id",
        file_unique_id: "unique-id",
        file_name: "test.txt",
        mime_type: "text/plain",
        file_size: 1024,
      },
      caption: "",
      ...overrides,
    },
    reply: replyMock,
    api: {
      getFile: vi.fn().mockResolvedValue({
        file_path: "documents/test.txt",
        file_size: 1024,
      }),
    },
  } as unknown as Context;

  return { ctx, replyMock };
}

function createDocumentDeps(overrides: Partial<DocumentHandlerDeps> = {}): {
  deps: DocumentHandlerDeps;
  processPromptMock: ReturnType<typeof vi.fn>;
  downloadMock: ReturnType<typeof vi.fn>;
  getCapabilitiesMock: ReturnType<typeof vi.fn>;
  getStoredModelMock: ReturnType<typeof vi.fn>;
  saveFileToWorkspaceMock: ReturnType<typeof vi.fn>;
} {
  const processPromptMock = vi.fn().mockResolvedValue(true);
  const downloadMock = vi.fn().mockResolvedValue({
    buffer: Buffer.from("file content here"),
    filePath: "documents/test.txt",
  });
  const getCapabilitiesMock = vi.fn().mockResolvedValue({
    input: { pdf: true, image: true },
  });
  const getStoredModelMock = vi.fn().mockReturnValue({
    providerID: "test-provider",
    modelID: "test-model",
  });
  const saveFileToWorkspaceMock = vi.fn().mockResolvedValue("/workspace/test.txt");

  const deps: DocumentHandlerDeps = {
    bot: {} as DocumentHandlerDeps["bot"],
    ensureEventSubscription: vi.fn().mockResolvedValue(undefined),
    downloadFile: downloadMock,
    getModelCapabilities: getCapabilitiesMock,
    getStoredModel: getStoredModelMock,
    processPrompt: processPromptMock,
    saveFileToWorkspace: saveFileToWorkspaceMock,
    ...overrides,
  };

  return { deps, processPromptMock, downloadMock, getCapabilitiesMock, getStoredModelMock, saveFileToWorkspaceMock };
}

describe("bot/handlers/document", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("text files", () => {
    it("downloads and sends text file content as prompt", async () => {
      const { ctx, replyMock } = createDocumentContext();
      const { deps, processPromptMock, downloadMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("Content of test.txt"),
        deps,
      );
    });

    it("includes caption in prompt after file content", async () => {
      const { ctx } = createDocumentContext({ caption: "Please review this file" });
      const { deps, processPromptMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("Please review this file"),
        deps,
      );
    });

    it("rejects text file larger than limit", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "doc-file-id",
          file_unique_id: "unique-id",
          file_name: "large.txt",
          mime_type: "text/plain",
          file_size: 200 * 1024, // 200KB
        },
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.text_file_too_large", { maxSizeKb: "100" }));
      expect(downloadMock).not.toHaveBeenCalled();
      expect(processPromptMock).not.toHaveBeenCalled();
    });

    it("saves text file to workspace after download", async () => {
      const { ctx } = createDocumentContext();
      const { deps, downloadMock, saveFileToWorkspaceMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(downloadMock).toHaveBeenCalled();
      expect(saveFileToWorkspaceMock).toHaveBeenCalledWith(
        "test.txt",
        expect.any(Buffer),
      );
    });

    it("accepts application/json as text file", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "doc-file-id",
          file_unique_id: "unique-id",
          file_name: "config.json",
          mime_type: "application/json",
          file_size: 500,
        },
      });
      const { deps, processPromptMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(processPromptMock).toHaveBeenCalled();
    });

    it("accepts application/xml as text file", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "doc-file-id",
          file_unique_id: "unique-id",
          file_name: "data.xml",
          mime_type: "application/xml",
          file_size: 500,
        },
      });
      const { deps, processPromptMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(processPromptMock).toHaveBeenCalled();
    });

    it("accepts application/javascript as text file", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "doc-file-id",
          file_unique_id: "unique-id",
          file_name: "script.js",
          mime_type: "application/javascript",
          file_size: 500,
        },
      });
      const { deps, processPromptMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(processPromptMock).toHaveBeenCalled();
    });
  });

  describe("PDF files", () => {
    it("downloads and sends PDF when model supports it", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "pdf-file-id",
          file_unique_id: "pdf-unique-id",
          file_name: "document.pdf",
          mime_type: "application/pdf",
          file_size: 5000,
        },
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("[File saved at:"),
        deps,
        expect.arrayContaining([
          expect.objectContaining({ type: "file", mime: "application/pdf" }),
        ]),
      );
    });

    it("downloads and sends path when model does not support PDF", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "pdf-file-id",
          file_unique_id: "pdf-unique-id",
          file_name: "document.pdf",
          mime_type: "application/pdf",
          file_size: 5000,
        },
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps({
        getModelCapabilities: vi.fn().mockResolvedValue({
          input: { pdf: false },
        }),
      });

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("[File saved at:"),
        deps,
        undefined,
      );
    });

    it("sends prompt with path when model does not support PDF but caption exists", async () => {
      const { ctx } = createDocumentContext({
        document: {
          file_id: "pdf-file-id",
          file_unique_id: "pdf-unique-id",
          file_name: "document.pdf",
          mime_type: "application/pdf",
          file_size: 5000,
        },
        caption: "Summarize this document",
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps({
        getModelCapabilities: vi.fn().mockResolvedValue({
          input: { pdf: false },
        }),
      });

      await handleDocumentMessage(ctx, deps);

      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("Summarize this document"),
        deps,
        undefined,
      );
    });

    it("saves PDF to workspace after download", async () => {
      const { ctx } = createDocumentContext({
        document: {
          file_id: "pdf-file-id",
          file_unique_id: "pdf-unique-id",
          file_name: "document.pdf",
          mime_type: "application/pdf",
          file_size: 5000,
        },
      });
      const { deps, downloadMock, saveFileToWorkspaceMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(downloadMock).toHaveBeenCalled();
      expect(saveFileToWorkspaceMock).toHaveBeenCalledWith(
        "document.pdf",
        expect.any(Buffer),
      );
    });
  });

  describe("image files", () => {
    it("downloads and sends image documents when model supports images", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "image-file-id",
          file_unique_id: "image-unique-id",
          file_name: "photo.png",
          mime_type: "image/png",
          file_size: 5000,
        },
        caption: "Describe this image",
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("Describe this image"),
        deps,
        expect.arrayContaining([
          expect.objectContaining({
            type: "file",
            mime: "image/png",
            filename: "photo.png",
            url: expect.stringMatching(/^data:image\/png;base64,/),
          }),
        ]),
      );
    });

    it("downloads and sends path when model does not support images", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "image-file-id",
          file_unique_id: "image-unique-id",
          file_name: "photo.png",
          mime_type: "image/png",
          file_size: 5000,
        },
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps({
        getModelCapabilities: vi.fn().mockResolvedValue({
          input: { image: false },
        }),
      });

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_downloading"));
      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("[File saved at:"),
        deps,
        undefined,
      );
    });

    it("sends prompt with path when model does not support images but caption exists", async () => {
      const { ctx } = createDocumentContext({
        document: {
          file_id: "image-file-id",
          file_unique_id: "image-unique-id",
          file_name: "photo.png",
          mime_type: "image/png",
          file_size: 5000,
        },
        caption: "Describe this image",
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps({
        getModelCapabilities: vi.fn().mockResolvedValue({
          input: { image: false },
        }),
      });

      await handleDocumentMessage(ctx, deps);

      expect(downloadMock).toHaveBeenCalled();
      expect(processPromptMock).toHaveBeenCalledWith(
        ctx,
        expect.stringContaining("Describe this image"),
        deps,
        undefined,
      );
    });

    it("saves image document to workspace after download", async () => {
      const { ctx } = createDocumentContext({
        document: {
          file_id: "image-file-id",
          file_unique_id: "image-unique-id",
          file_name: "photo.png",
          mime_type: "image/png",
          file_size: 5000,
        },
      });
      const { deps, downloadMock, saveFileToWorkspaceMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(downloadMock).toHaveBeenCalled();
      expect(saveFileToWorkspaceMock).toHaveBeenCalledWith(
        "photo.png",
        expect.any(Buffer),
      );
    });
  });

  describe("unsupported file types", () => {
    it("shows error for unsupported MIME types", async () => {
      const { ctx, replyMock } = createDocumentContext({
        document: {
          file_id: "zip-file-id",
          file_unique_id: "zip-unique-id",
          file_name: "archive.zip",
          mime_type: "application/zip",
          file_size: 5000,
        },
      });
      const { deps, processPromptMock, downloadMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_type_unsupported"));
      expect(downloadMock).not.toHaveBeenCalled();
      expect(processPromptMock).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("shows download error when file download fails", async () => {
      const { ctx, replyMock } = createDocumentContext();
      const { deps } = createDocumentDeps({
        downloadFile: vi.fn().mockRejectedValue(new Error("Network error")),
      });

      await handleDocumentMessage(ctx, deps);

      expect(replyMock).toHaveBeenCalledWith(t("bot.file_download_error"));
    });
  });

  describe("missing document", () => {
    it("returns early when no document in message", async () => {
      const ctx = { chat: { id: 777 }, message: {} } as unknown as Context;
      const { deps, processPromptMock } = createDocumentDeps();

      await handleDocumentMessage(ctx, deps);

      expect(processPromptMock).not.toHaveBeenCalled();
    });
  });
});

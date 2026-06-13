import { beforeEach, describe, expect, it, vi } from "vitest";
import os from "node:os";

const mockUploadDir = vi.hoisted(() => ({ value: "uploads" }));
const mockGetCurrentProject = vi.hoisted(() =>
  vi.fn().mockReturnValue({ id: "p1", worktree: "/home/user/project" }),
);

vi.mock("../../../src/config.js", () => ({
  config: {
    workspace: {
      get uploadDir() {
        return mockUploadDir.value;
      },
    },
    telegram: { token: "test", allowedUserId: 0, proxyUrl: "" },
    opencode: {
      apiUrl: "http://localhost:4096",
      username: "opencode",
      password: "",
      model: { provider: "test", modelId: "test" },
    },
    server: { logLevel: "error" },
    bot: {
      sessionsListLimit: 10,
      projectsListLimit: 10,
      locale: "en",
      hideThinkingMessages: false,
      hideToolCallMessages: false,
    },
    files: { maxFileSizeKb: 100 },
  },
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: mockGetCurrentProject,
}));

const mockFsMkdir = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockFsWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockFsAccess = vi.hoisted(() =>
  vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
);

vi.mock("node:fs", () => ({
  promises: {
    mkdir: mockFsMkdir,
    writeFile: mockFsWriteFile,
    access: mockFsAccess,
  },
}));

vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  buildWorkspaceSystemContext,
  ensureWorkspaceDir,
  getWorkspacePath,
  saveFileToWorkspace,
} from "../../../src/bot/utils/workspace.js";

describe("bot/utils/workspace", () => {
  beforeEach(() => {
    mockUploadDir.value = "uploads";
    mockGetCurrentProject.mockReturnValue({ id: "p1", worktree: "/home/user/project" });
    mockFsMkdir.mockReset().mockResolvedValue(undefined);
    mockFsWriteFile.mockReset().mockResolvedValue(undefined);
    mockFsAccess.mockReset().mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
  });

  describe("getWorkspacePath", () => {
    it("resolves relative upload dir against project worktree", () => {
      mockUploadDir.value = "uploads";
      const result = getWorkspacePath();
      expect(result).toBe("/home/user/project/uploads");
    });

    it("returns absolute path directly", () => {
      mockUploadDir.value = "/var/workspace";
      const result = getWorkspacePath();
      expect(result).toBe("/var/workspace");
    });

    it("returns null when no project is selected", () => {
      mockGetCurrentProject.mockReturnValue(undefined);
      const result = getWorkspacePath();
      expect(result).toBeNull();
    });
  });

  describe("ensureWorkspaceDir", () => {
    it("creates the workspace directory if it does not exist", async () => {
      const result = await ensureWorkspaceDir();
      expect(result).toBe("/home/user/project/uploads");
      expect(mockFsMkdir).toHaveBeenCalledWith("/home/user/project/uploads", { recursive: true });
    });

    it("returns null when no project is selected", async () => {
      mockGetCurrentProject.mockReturnValue(undefined);
      const result = await ensureWorkspaceDir();
      expect(result).toBeNull();
      expect(mockFsMkdir).not.toHaveBeenCalled();
    });

    it("returns null when mkdir fails", async () => {
      mockFsMkdir.mockRejectedValue(new Error("ENOSPC"));
      const result = await ensureWorkspaceDir();
      expect(result).toBeNull();
    });

    it("falls back to home directory when EACCES on project worktree", async () => {
      mockGetCurrentProject.mockReturnValue({ id: "p1", worktree: "/" });
      const eaccesError = Object.assign(new Error("EACCES"), { code: "EACCES" });
      mockFsMkdir
        .mockRejectedValueOnce(eaccesError)
        .mockResolvedValueOnce(undefined);

      const result = await ensureWorkspaceDir();

      const expectedFallback = `${os.homedir()}/uploads`;
      expect(result).toBe(expectedFallback);
      expect(mockFsMkdir).toHaveBeenCalledWith("/uploads", { recursive: true });
      expect(mockFsMkdir).toHaveBeenCalledWith(expectedFallback, { recursive: true });
    });
  });

  describe("saveFileToWorkspace", () => {
    it("saves file to the workspace directory", async () => {
      const buffer = Buffer.from("test content");
      const result = await saveFileToWorkspace("photo.jpg", buffer);

      expect(result).toBe("/home/user/project/uploads/photo.jpg");
      expect(mockFsMkdir).toHaveBeenCalledWith("/home/user/project/uploads", { recursive: true });
      expect(mockFsWriteFile).toHaveBeenCalledWith("/home/user/project/uploads/photo.jpg", buffer);
    });

    it("sanitizes filename with illegal characters", async () => {
      const buffer = Buffer.from("test");
      await saveFileToWorkspace("file<name>.txt", buffer);

      const writeCall = mockFsWriteFile.mock.calls[0];
      expect(writeCall[0]).toBe("/home/user/project/uploads/file_name_.txt");
    });

    it("appends timestamp when filename exists", async () => {
      mockFsAccess.mockResolvedValueOnce(undefined);
      const buffer = Buffer.from("test");
      const result = await saveFileToWorkspace("photo.jpg", buffer);

      expect(result).toMatch(/\/home\/user\/project\/uploads\/photo_\d+\.jpg$/);
    });

    it("returns null when no project is selected", async () => {
      mockGetCurrentProject.mockReturnValue(undefined);
      const buffer = Buffer.from("test");
      const result = await saveFileToWorkspace("photo.jpg", buffer);

      expect(result).toBeNull();
      expect(mockFsWriteFile).not.toHaveBeenCalled();
    });

    it("returns null when write fails", async () => {
      mockFsWriteFile.mockRejectedValue(new Error("EACCES"));
      const buffer = Buffer.from("test");
      const result = await saveFileToWorkspace("photo.jpg", buffer);

      expect(result).toBeNull();
    });

    it("saves to fallback path when project worktree requires root", async () => {
      mockGetCurrentProject.mockReturnValue({ id: "p1", worktree: "/" });
      const eaccesError = Object.assign(new Error("EACCES"), { code: "EACCES" });
      mockFsMkdir
        .mockRejectedValueOnce(eaccesError)
        .mockResolvedValueOnce(undefined);
      const buffer = Buffer.from("test content");

      const result = await saveFileToWorkspace("photo.jpg", buffer);

      const expectedFallback = `${os.homedir()}/uploads/photo.jpg`;
      expect(result).toBe(expectedFallback);
      expect(mockFsWriteFile).toHaveBeenCalledWith(expectedFallback, buffer);
    });
  });

  describe("buildWorkspaceSystemContext", () => {
    it("returns system context with workspace path", async () => {
      const result = await buildWorkspaceSystemContext();

      expect(result).toContain("/home/user/project/uploads");
      expect(result).toContain("Telegram API");
    });

    it("returns null when no project is selected", async () => {
      mockGetCurrentProject.mockReturnValue(undefined);
      const result = await buildWorkspaceSystemContext();

      expect(result).toBeNull();
    });

    it("returns fallback path in system context when project worktree requires root", async () => {
      mockGetCurrentProject.mockReturnValue({ id: "p1", worktree: "/" });
      const eaccesError = Object.assign(new Error("EACCES"), { code: "EACCES" });
      mockFsMkdir
        .mockRejectedValueOnce(eaccesError)
        .mockResolvedValueOnce(undefined);

      const result = await buildWorkspaceSystemContext();

      expect(result).toContain(`${os.homedir()}/uploads`);
      expect(result).toContain("Telegram API");
    });
  });
});

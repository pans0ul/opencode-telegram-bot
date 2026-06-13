import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";
import { config } from "../../config.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";

export function getWorkspacePath(): string | null {
  const project = getCurrentProject();
  if (!project) {
    return null;
  }

  const uploadDir = config.workspace.uploadDir;

  if (path.isAbsolute(uploadDir)) {
    return uploadDir;
  }

  return path.resolve(project.worktree, uploadDir);
}

function getFallbackWorkspacePath(): string {
  return path.join(os.homedir(), config.workspace.uploadDir);
}

export async function resolveWorkspacePath(): Promise<string | null> {
  let workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return null;
  }

  try {
    await fs.mkdir(workspacePath, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EACCES") {
      workspacePath = getFallbackWorkspacePath();
      try {
        await fs.mkdir(workspacePath, { recursive: true });
      } catch (innerErr) {
        logger.warn("[Workspace] Failed to create fallback workspace directory", innerErr);
        return null;
      }
    } else {
      logger.warn("[Workspace] Failed to create workspace directory", err);
      return null;
    }
  }

  return workspacePath;
}

export async function ensureWorkspaceDir(): Promise<string | null> {
  return resolveWorkspacePath();
}

async function makeUniqueName(dir: string, filename: string): Promise<string> {
  const targetPath = path.join(dir, filename);

  try {
    await fs.access(targetPath);
  } catch {
    return targetPath;
  }

  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  const timestamp = Date.now();

  return path.join(dir, `${base}_${timestamp}${ext}`);
}

export async function saveFileToWorkspace(
  filename: string,
  buffer: Buffer,
): Promise<string | null> {
  const workspaceDir = await ensureWorkspaceDir();
  if (!workspaceDir) {
    return null;
  }

  const safeName = filename.replace(/[/\\:*?"<>|]/g, "_");
  const targetPath = await makeUniqueName(workspaceDir, safeName);

  try {
    await fs.writeFile(targetPath, buffer);
    logger.info(`[Workspace] Saved file: ${targetPath}`);
    return targetPath;
  } catch (err) {
    logger.warn(`[Workspace] Failed to write file ${targetPath}`, err);
    return null;
  }
}

const CODE_FILE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala",
  ".json", ".yaml", ".yml", ".xml", ".toml", ".ini", ".cfg",
  ".txt", ".md", ".mdx", ".css", ".scss", ".less", ".html", ".htm",
  ".diff", ".patch", ".sql", ".sh", ".bash", ".zsh", ".fish",
]);

async function walkDir(dir: string, files: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_FILE_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
}

export async function findOutputFilesAfter(timestamp: number): Promise<string[]> {
  const workspaceDir = await resolveWorkspacePath();
  if (!workspaceDir) {
    return [];
  }

  const allFiles: string[] = [];
  await walkDir(workspaceDir, allFiles);

  const result: string[] = [];
  for (const filePath of allFiles) {
    try {
      const fileStat = await fs.stat(filePath);
      if (fileStat.mtimeMs > timestamp) {
        result.push(filePath);
      }
    } catch {
      // file may have been deleted
    }
  }

  return result;
}

const snapshots = new Map<string, Set<string>>();

export async function takeWorkspaceSnapshot(sessionId: string): Promise<void> {
  const workspaceDir = await resolveWorkspacePath();
  if (!workspaceDir) {
    return;
  }

  const files = new Set<string>();
  await walkDir(workspaceDir, [...files] as unknown as string[]);
  // walkDir pushes to the array, but we need a set. Re-scan properly:
  files.clear();
  const fileList: string[] = [];
  await walkDir(workspaceDir, fileList);
  for (const f of fileList) {
    files.add(f);
  }

  snapshots.set(sessionId, files);
}

export async function diffWorkspaceSnapshot(sessionId: string): Promise<string[]> {
  const before = snapshots.get(sessionId);
  snapshots.delete(sessionId);

  const workspaceDir = await resolveWorkspacePath();
  if (!workspaceDir || !before) {
    return [];
  }

  const afterList: string[] = [];
  await walkDir(workspaceDir, afterList);
  const after = new Set(afterList);

  const newFiles: string[] = [];
  for (const f of after) {
    if (!before.has(f)) {
      newFiles.push(f);
    }
  }

  return newFiles;
}

export async function buildWorkspaceSystemContext(): Promise<string | null> {
  const workspacePath = await resolveWorkspacePath();
  if (!workspacePath) {
    return null;
  }

  return `When the user asks you to send or share a file, save it to the directory: ${workspacePath}. Files in this directory will be automatically sent to the user via Telegram API.`;
}

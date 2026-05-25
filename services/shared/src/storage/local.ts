import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join, dirname, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageObjectKind } from "../types/index";
import type { StorageProvider } from "./types";
import { getPublicUploadBaseUrl, getStorageRoot } from "../env/index";

const KIND_DIRS: Record<StorageObjectKind, string> = {
  scans: "scans",
  audio: "audio",
  masks: "masks",
  reports: "reports",
  attachments: "attachments",
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;
  private readonly publicBase: string;

  constructor(root?: string, publicBase?: string) {
    this.root = resolve(root ?? getStorageRoot());
    this.publicBase = (publicBase ?? getPublicUploadBaseUrl()).replace(/\/$/, "");
  }

  private absPath(relativePath: string): string {
    const normalized = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = resolve(this.root, normalized);
    if (!full.startsWith(this.root)) {
      throw new Error("Invalid storage path");
    }
    return full;
  }

  async upload(
    kind: StorageObjectKind,
    fileName: string,
    data: Buffer,
    mimeType: string
  ): Promise<{ path: string; url: string }> {
    const ext = safeFileName(fileName).includes(".")
      ? safeFileName(fileName).split(".").pop()
      : mimeType.split("/")[1] || "bin";
    const rel = `${KIND_DIRS[kind]}/${randomUUID()}.${ext}`;
    const abs = this.absPath(rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, data, { mode: 0o600 });
    return { path: rel, url: this.getUrl(rel) };
  }

  async delete(path: string): Promise<void> {
    try {
      await unlink(this.absPath(path));
    } catch {
      /* ignore missing */
    }
  }

  getUrl(path: string): string {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `${this.publicBase}/${encoded}`;
  }

  async read(path: string): Promise<Buffer> {
    return readFile(this.absPath(path));
  }
}

/** Future: R2StorageProvider implements same StorageProvider interface. */

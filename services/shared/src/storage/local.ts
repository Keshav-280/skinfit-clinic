import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { dirname, normalize, resolve } from "node:path";
import type { StorageObjectKind } from "../types/index";
import type { StorageProvider } from "./types";
import { getPublicUploadBaseUrl, getStorageRoot } from "../env/index";
import { buildStorageObjectKey, fileUrlPath } from "./paths";

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
    const rel = buildStorageObjectKey(kind, fileName, mimeType);
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

  /** Relative path so dashboard `<img>` shares origin + session cookie with the app. */
  getUrl(path: string): string {
    return fileUrlPath(path);
  }

  getAbsoluteUrl(path: string): string {
    return `${this.publicBase}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  async read(path: string): Promise<Buffer> {
    return readFile(this.absPath(path));
  }
}


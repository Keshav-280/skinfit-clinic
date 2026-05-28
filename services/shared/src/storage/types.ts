import type { StorageObjectKind } from "../types/index";

export interface StorageProvider {
  upload(
    kind: StorageObjectKind,
    fileName: string,
    data: Buffer,
    mimeType: string
  ): Promise<{ path: string; url: string }>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
  getAbsoluteUrl?(path: string): string;
  read(path: string): Promise<Buffer>;
}

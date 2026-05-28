import { randomUUID } from "node:crypto";
import type { StorageObjectKind } from "../types/index";

export const KIND_DIRS: Record<StorageObjectKind, string> = {
  scans: "scans",
  audio: "audio",
  masks: "masks",
  reports: "reports",
  attachments: "attachments",
};

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/** Relative object key (e.g. `scans/uuid.jpg`) used in DB and storage drivers. */
export function buildStorageObjectKey(
  kind: StorageObjectKind,
  fileName: string,
  mimeType: string
): string {
  const safe = safeFileName(fileName);
  const ext = safe.includes(".")
    ? safe.split(".").pop()
    : mimeType.split("/")[1] || "bin";
  return `${KIND_DIRS[kind]}/${randomUUID()}.${ext}`;
}

export function fileUrlPath(relativePath: string): string {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `/api/files/${encoded}`;
}

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageObjectKind } from "../types/index";
import { buildStorageObjectKey, fileUrlPath } from "./paths";
import { createR2ClientFromEnv, getR2ConfigFromEnv } from "./r2";

const DEFAULT_EXPIRES_SEC = 600;

export type PresignedUpload = {
  uploadUrl: string;
  path: string;
  url: string;
  method: "PUT";
  expiresIn: number;
  headers: { "Content-Type": string };
};

/** Short-lived PUT URL for direct client → R2 upload (private bucket). */
export async function createPresignedUpload(
  kind: StorageObjectKind,
  fileName: string,
  mimeType: string,
  expiresIn = DEFAULT_EXPIRES_SEC
): Promise<PresignedUpload> {
  const config = getR2ConfigFromEnv();
  const key = buildStorageObjectKey(kind, fileName, mimeType);
  const contentType = mimeType || "application/octet-stream";
  const client = createR2ClientFromEnv();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return {
    uploadUrl,
    path: key,
    url: fileUrlPath(key),
    method: "PUT",
    expiresIn,
    headers: { "Content-Type": contentType },
  };
}

const STORAGE_KEY_PREFIX = /^(scans|audio|masks|reports|attachments)\//;

export function assertSafeStoragePath(path: string): void {
  const normalized = path.replace(/^\/+/, "");
  if (normalized.includes("..") || !STORAGE_KEY_PREFIX.test(normalized)) {
    throw new Error("Invalid storage path");
  }
}

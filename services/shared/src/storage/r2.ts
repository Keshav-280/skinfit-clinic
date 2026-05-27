import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageObjectKind } from "../types/index";
import type { StorageProvider } from "./types";
import { buildStorageObjectKey, fileUrlPath } from "./paths";
import { getPublicUploadBaseUrl } from "../env/index";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

export function getR2ConfigFromEnv(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    throw new Error(
      "R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (optional R2_ENDPOINT)."
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(config?: R2Config, publicBase?: string) {
    const c = config ?? getR2ConfigFromEnv();
    this.client = createR2Client(c);
    this.bucket = c.bucket;
    this.publicBase = (publicBase ?? getPublicUploadBaseUrl()).replace(/\/$/, "");
  }

  async upload(
    kind: StorageObjectKind,
    fileName: string,
    data: Buffer,
    mimeType: string
  ): Promise<{ path: string; url: string }> {
    const key = buildStorageObjectKey(kind, fileName, mimeType);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType || "application/octet-stream",
      })
    );
    return { path: key, url: this.getUrl(key) };
  }

  async delete(path: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: path })
      );
    } catch {
      /* ignore missing */
    }
  }

  getUrl(path: string): string {
    return fileUrlPath(path);
  }

  getAbsoluteUrl(path: string): string {
    return `${this.publicBase}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  async read(path: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: path })
    );
    return bodyToBuffer(res.Body);
  }
}

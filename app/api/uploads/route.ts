import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getStorage, logger } from "@/src/lib/infra";
import type { StorageObjectKind } from "@/src/lib/infra";
import { checkRateLimit } from "@/src/lib/security/rateLimit";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_KINDS: StorageObjectKind[] = [
  "scans",
  "audio",
  "masks",
  "reports",
  "attachments",
  "annotator",
];

/**
 * POST /api/uploads?kind=scans
 * Multipart field: file
 * Returns { path, url } - store path/URL in DB only.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`upload:${userId}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  const kind = (request.nextUrl.searchParams.get("kind") ||
    "scans") as StorageObjectKind;
  if (!ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  try {
    const result = await storage.upload(
      kind,
      file.name || "upload.bin",
      buf,
      file.type || "application/octet-stream"
    );
    logger.request("POST", "/api/uploads", { userId, kind, path: result.path });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    logger.error("upload_failed", { userId, error: String(err) });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

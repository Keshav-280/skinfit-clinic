import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { createPresignedUpload } from "@/src/lib/infra";
import type { StorageObjectKind } from "@/src/lib/infra";
import { checkRateLimit } from "@/src/lib/security/rateLimit";

const ALLOWED_KINDS: StorageObjectKind[] = [
  "scans",
  "audio",
  "masks",
  "reports",
  "attachments",
];

/**
 * POST /api/uploads/presign?kind=scans
 * Body JSON: { fileName?: string, contentType?: string }
 * Returns presigned PUT URL for direct R2 upload (STORAGE_DRIVER=r2 only).
 */
export async function POST(request: NextRequest) {
  if (process.env.STORAGE_DRIVER?.trim() !== "r2") {
    return NextResponse.json(
      {
        error:
          "Presigned uploads require STORAGE_DRIVER=r2. Use POST /api/uploads (multipart) instead.",
      },
      { status: 501 }
    );
  }

  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`presign:${userId}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const kind = (request.nextUrl.searchParams.get("kind") ||
    "scans") as StorageObjectKind;
  if (!ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  let fileName = "upload.jpg";
  let contentType = "image/jpeg";
  try {
    const body = (await request.json()) as {
      fileName?: string;
      contentType?: string;
    };
    if (typeof body.fileName === "string" && body.fileName.trim()) {
      fileName = body.fileName.trim();
    }
    if (typeof body.contentType === "string" && body.contentType.trim()) {
      contentType = body.contentType.trim();
    }
  } catch {
    /* optional body */
  }

  try {
    const presigned = await createPresignedUpload(
      kind,
      fileName,
      contentType
    );
    return NextResponse.json({ success: true, ...presigned });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not create upload URL", detail: String(err) },
      { status: 500 }
    );
  }
}

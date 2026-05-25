import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve, normalize } from "node:path";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getStorageRoot } from "@/src/lib/infra";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};

/**
 * GET /api/files/scans/<id>.jpg — serves local uploads (auth required).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await ctx.params;
  const rel = segments.map(decodeURIComponent).join("/");
  const root = resolve(getStorageRoot());
  const full = resolve(root, normalize(rel));
  if (!full.startsWith(root)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buf = await readFile(full);
    const ext = rel.split(".").pop()?.toLowerCase() || "bin";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

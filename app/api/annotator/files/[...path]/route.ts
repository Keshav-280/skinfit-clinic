import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/src/lib/infra";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * GET /api/annotator/files/annotator/<uuid>.jpg
 * Serves annotator library images from R2 or local storage (no session required).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const auth = await requireAnnotatorAuth(request);
  if (auth) return auth;

  const { path: segments } = await ctx.params;
  const rel = segments.map(decodeURIComponent).join("/");
  if (rel.includes("..") || rel.startsWith("/") || !rel.startsWith("annotator/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buf = await getStorage().read(rel);
    const ext = rel.split(".").pop()?.toLowerCase() || "bin";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

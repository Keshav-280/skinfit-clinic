import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getStorage } from "@/src/lib/infra";

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
 * GET /api/files/scans/<id>.jpg — serves uploads from local disk or R2 (auth required).
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
  if (rel.includes("..") || rel.startsWith("/")) {
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

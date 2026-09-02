import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getStorage } from "@/src/lib/infra";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Annotator library files are content-addressed (UUID filenames never change),
// so they can be cached hard by the browser. This is the main lever for load
// speed: a normal refresh / revisiting an image then costs zero bytes.
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const MAX_THUMB_WIDTH = 640;

function parseThumbWidth(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, MAX_THUMB_WIDTH);
}

/**
 * GET /api/annotator/files/annotator/<uuid>.jpg
 * Serves annotator library images from R2 or local storage.
 *
 * `?w=<px>` returns a downscaled WebP - the thumbnail strip uses this so a
 * 56-150px thumbnail no longer downloads a 0.5-1.4MB full-res PNG. With ~526
 * images that turns a ~400MB cold load into a few MB.
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

  const thumbWidth = parseThumbWidth(request.nextUrl.searchParams.get("w"));

  try {
    const buf = await getStorage().read(rel);

    if (thumbWidth) {
      try {
        const resized = await sharp(buf)
          .rotate()
          .resize({ width: thumbWidth, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
        return new NextResponse(new Uint8Array(resized), {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": IMMUTABLE_CACHE,
          },
        });
      } catch {
        // Fall through to serving the original if resize fails.
      }
    }

    const ext = rel.split(".").pop()?.toLowerCase() || "bin";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": IMMUTABLE_CACHE,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

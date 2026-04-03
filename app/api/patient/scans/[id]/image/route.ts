import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

function decodeDataUrlImage(dataUrl: string): { mime: string; buffer: Buffer } | null {
  if (!dataUrl.startsWith("data:")) return null;
  const semi = dataUrl.indexOf(";");
  const comma = dataUrl.indexOf(",");
  if (semi < 0 || comma < 0 || comma <= semi) return null;
  const mime = dataUrl.slice(5, semi).trim() || "image/jpeg";
  const meta = dataUrl.slice(semi + 1, comma);
  if (!meta.includes("base64")) return null;
  const b64 = dataUrl.slice(comma + 1).trim();
  try {
    return { mime, buffer: Buffer.from(b64, "base64") };
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const row = await db.query.scans.findFirst({
    where: and(eq(scans.id, id), eq(scans.userId, userId)),
    columns: { imageUrl: true },
  });

  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const url = row.imageUrl?.trim() ?? "";
  if (!url || url === "pending_upload") {
    return NextResponse.json({ error: "IMAGE_NOT_READY" }, { status: 404 });
  }

  if (url.startsWith("data:")) {
    const decoded = decodeDataUrlImage(url);
    if (!decoded || decoded.buffer.length === 0) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 500 });
    }
    return new NextResponse(new Uint8Array(decoded.buffer), {
      status: 200,
      headers: {
        "Content-Type": decoded.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ error: "UNSUPPORTED_IMAGE_URL" }, { status: 500 });
}

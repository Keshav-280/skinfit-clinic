import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getStorage } from "@/src/lib/infra";

export const runtime = "nodejs";

/** Public PDF download via share token (QR / email link). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (!token?.trim()) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const row = await db.query.clinicExternalReports.findFirst({
    where: eq(clinicExternalReports.shareToken, token.trim()),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!row.storagePath?.trim()) {
    return Response.json({ error: "PDF_NOT_ATTACHED" }, { status: 404 });
  }

  const buf = await getStorage().read(row.storagePath);
  const safeName = row.title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

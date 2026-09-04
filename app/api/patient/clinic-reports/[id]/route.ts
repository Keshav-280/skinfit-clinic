import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getStorage } from "@/src/lib/infra";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, id),
      eq(clinicExternalReports.patientUserId, userId)
    ),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("download") === "1") {
    if (!row.storagePath?.trim()) {
      return Response.json({ error: "PDF_NOT_ATTACHED" }, { status: 404 });
    }
    const buf = await getStorage().read(row.storagePath);
    const mime = row.mimeType?.trim() || "application/pdf";
    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime.startsWith("image/")
            ? "jpg"
            : "pdf";
    const safeName = row.title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${safeName}.${ext}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return Response.json({
    id: row.id,
    title: row.title,
    kind: "external_clinic_report",
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    downloadUrl: `/api/patient/clinic-reports/${row.id}?download=1`,
  });
}

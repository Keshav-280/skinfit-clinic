import { desc, eq, and } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import {
  clinicReportShareUrl,
  findPatientByEmail,
  normalizePatientEmail,
  serializeClinicReportRow,
} from "@/src/lib/clinicExternalReports";
import { getStorage } from "@/src/lib/infra";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.query.clinicExternalReports.findMany({
    where: eq(clinicExternalReports.doctorId, doctorId),
    orderBy: [desc(clinicExternalReports.createdAt)],
    limit: 200,
  });

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const patient = await findPatientByEmail(row.patientEmail);
      return serializeClinicReportRow(row, {
        accountExists: Boolean(patient?.id),
        shareUrl: clinicReportShareUrl(row.shareToken),
      });
    })
  );

  return Response.json({ reports: enriched });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const emailRaw = form.get("patientEmail");
  const nameRaw = form.get("patientName");
  const titleRaw = form.get("title");
  const attachToId = form.get("attachToId");

  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return Response.json({ error: "patientEmail required" }, { status: 400 });
  }

  const patientEmail = normalizePatientEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
    return Response.json({ error: "Invalid patientEmail" }, { status: 400 });
  }

  const patientName =
    typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim().slice(0, 255) : null;

  const patient = await findPatientByEmail(patientEmail);

  // Attach PDF to an existing email-only draft
  if (typeof attachToId === "string" && attachToId.trim() && file instanceof File && file.size > 0) {
    const existing = await db.query.clinicExternalReports.findFirst({
      where: and(
        eq(clinicExternalReports.id, attachToId.trim()),
        eq(clinicExternalReports.doctorId, doctorId)
      ),
    });
    if (!existing) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const title =
      typeof titleRaw === "string" && titleRaw.trim()
        ? titleRaw.trim().slice(0, 255)
        : existing.title;
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const uploaded = await storage.upload(
      "reports",
      `${title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
      pdfBuffer,
      "application/pdf"
    );
    const [row] = await db
      .update(clinicExternalReports)
      .set({
        title,
        patientName: patientName ?? existing.patientName,
        storagePath: uploaded.path,
        updatedAt: new Date(),
      })
      .where(eq(clinicExternalReports.id, existing.id))
      .returning();
    return Response.json({
      report: serializeClinicReportRow(row, {
        accountExists: Boolean(patient?.id),
        shareUrl: clinicReportShareUrl(row.shareToken),
      }),
    });
  }

  // Email-only draft (before scan / before PDF)
  if (!(file instanceof File) || file.size === 0) {
    const title =
      typeof titleRaw === "string" && titleRaw.trim()
        ? titleRaw.trim().slice(0, 255)
        : patientName
          ? `${patientName} — skin report`
          : "Pending skin report";

    const [row] = await db
      .insert(clinicExternalReports)
      .values({
        doctorId,
        patientEmail,
        patientName,
        patientUserId: patient?.id ?? null,
        title,
        storagePath: null,
        status: "draft",
      })
      .returning();

    return Response.json({
      report: serializeClinicReportRow(row, {
        accountExists: Boolean(patient?.id),
      }),
    });
  }

  const title =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim().slice(0, 255)
      : file.name.replace(/\.pdf$/i, "") || "Skin analysis report";

  const pdfBuffer = Buffer.from(await file.arrayBuffer());
  if (!pdfBuffer.length) {
    return Response.json({ error: "Empty PDF" }, { status: 400 });
  }

  const storage = getStorage();
  const uploaded = await storage.upload(
    "reports",
    `${title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
    pdfBuffer,
    "application/pdf"
  );

  const [row] = await db
    .insert(clinicExternalReports)
    .values({
      doctorId,
      patientEmail,
      patientName,
      patientUserId: patient?.id ?? null,
      title,
      storagePath: uploaded.path,
      status: "draft",
    })
    .returning();

  return Response.json({
    report: serializeClinicReportRow(row, {
      accountExists: Boolean(patient?.id),
      shareUrl: clinicReportShareUrl(row.shareToken),
    }),
  });
}

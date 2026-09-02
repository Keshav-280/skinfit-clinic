import { desc, eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import {
  clinicReportShareUrl,
  findPatientByEmail,
  listRecentClinicReportPatients,
  normalizePatientEmail,
  serializeClinicReportRow,
} from "@/src/lib/clinicExternalReports";
import { getStorage } from "@/src/lib/infra";

export const runtime = "nodejs";
export const maxDuration = 120;

function parsePatientName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().slice(0, 255);
}

function parsePatientEmail(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const normalized = normalizePatientEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid patientEmail");
  }
  return normalized;
}

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
      const patient = row.patientEmail ? await findPatientByEmail(row.patientEmail) : null;
      return serializeClinicReportRow(row, {
        accountExists: Boolean(patient?.id),
        shareUrl: clinicReportShareUrl(row.shareToken),
      });
    })
  );

  const recentPatients = await listRecentClinicReportPatients(doctorId);

  return Response.json({ reports: enriched, recentPatients });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const nameRaw = form.get("patientName");
    const emailRaw = form.get("patientEmail");
    const titleRaw = form.get("title");
    const attachToId = form.get("attachToId");

    const patientName = parsePatientName(nameRaw);
    if (!patientName) {
      return Response.json({ error: "patientName required" }, { status: 400 });
    }

    let patientEmail: string | null = null;
    try {
      patientEmail = parsePatientEmail(emailRaw);
    } catch {
      return Response.json({ error: "Invalid patientEmail" }, { status: 400 });
    }

    const patient = patientEmail ? await findPatientByEmail(patientEmail) : null;

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
          patientName,
          patientEmail: patientEmail ?? existing.patientEmail,
          patientUserId: patient?.id ?? existing.patientUserId,
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

    if (!(file instanceof File) || file.size === 0) {
      const title =
        typeof titleRaw === "string" && titleRaw.trim()
          ? titleRaw.trim().slice(0, 255)
          : `${patientName} - skin report`;

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
  } catch (err) {
    console.error("[clinic-reports POST]", err);
    return Response.json({ error: "Save failed" }, { status: 500 });
  }
}

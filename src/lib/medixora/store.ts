import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports, users } from "@/src/db/schema";
import { isPlaceholderEmail } from "@/src/lib/auth/placeholderEmail";
import { ensureClinicDeviceReportColumns } from "@/src/lib/clinicExternalReports";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { getStorage, invalidateUserHistoryCache } from "@/src/lib/infra";
import { fetchMedixoraReport, fetchReportPhotos, MedixoraError } from "@/src/lib/medixora/fetch";
import { buildReportContent } from "@/src/lib/medixora/content";
import { buildMedixoraPdf } from "@/src/lib/medixora/pdf";
import { formatScanDate } from "@/src/lib/medixora/report";

/**
 * Remembers which machine report went to which patient, so one report can never be saved twice
 * or to two people. The PDF itself is a normal clinic report in the patient's history.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS medixora_scans (
    report_key varchar(64) PRIMARY KEY,
    patient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_report_id uuid NOT NULL REFERENCES clinic_external_reports(id) ON DELETE CASCADE,
    scanned_at varchar(19),
    overall_score integer,
    scores jsonb NOT NULL,
    saved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS medixora_scans_patient_idx
    ON medixora_scans (patient_user_id, created_at DESC)`,
];

let ready: Promise<void> | null = null;

export function ensureMedixoraSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await ensureClinicDeviceReportColumns();
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const patientColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  phoneCountryCode: users.phoneCountryCode,
  age: users.age,
  gender: users.gender,
};

type PatientRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phoneCountryCode: string;
  age: number | null;
  gender: string | null;
};

const toPatient = (r: PatientRecord) => ({
  id: r.id,
  name: r.name,
  phone: r.phone ? `${r.phoneCountryCode} ${r.phone}` : null,
  email: isPlaceholderEmail(r.email) ? null : r.email,
  age: r.age,
  gender: r.gender,
});

export async function findPatient(patientId: string) {
  if (!isUuid(patientId)) return null;
  const [row] = await db
    .select(patientColumns)
    .from(users)
    .where(and(eq(users.id, patientId), eq(users.role, "patient")))
    .limit(1);
  return row ? toPatient(row) : null;
}

export const PATIENT_PAGE = 100;

/** Every patient account, newest first, searchable by name, mobile or email. */
export async function searchPatients(query: string) {
  await ensureClinicDeviceReportColumns();
  const q = query.trim().slice(0, 80).replace(/[\\%_]/g, "\\$&");
  const digits = query.replace(/\D/g, "");
  const match = q
    ? or(
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
        ...(digits.length >= 3 ? [ilike(users.phone, `%${digits.slice(-10)}%`)] : [])
      )
    : undefined;
  const rows = await db
    .select(patientColumns)
    .from(users)
    .where(and(eq(users.role, "patient"), match))
    .orderBy(desc(users.createdAt))
    .limit(PATIENT_PAGE);
  const counts = await db.execute(
    sql`SELECT patient_user_id, count(*)::int AS n FROM clinic_external_reports
        WHERE report_kind = 'medixora' AND storage_path IS NOT NULL AND patient_user_id IS NOT NULL
        GROUP BY patient_user_id`
  );
  const byPatient = new Map(counts.rows.map((r) => [String(r.patient_user_id), Number(r.n)]));
  return rows.map((r) => ({ ...toPatient(r), reportCount: byPatient.get(r.id) ?? 0 }));
}

export async function listMedixoraReports(patientId: string) {
  await ensureMedixoraSchema();
  const res = await db.execute(
    sql`SELECT r.id, r.title, r.created_at, m.scanned_at, m.overall_score
        FROM clinic_external_reports r
        LEFT JOIN medixora_scans m ON m.clinic_report_id = r.id
        WHERE r.patient_user_id = ${patientId} AND r.report_kind = 'medixora'
          AND r.storage_path IS NOT NULL
        ORDER BY r.created_at DESC LIMIT 100`
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    addedAt: new Date(r.created_at as string).toISOString(),
    scanDate: r.scanned_at ? formatScanDate(String(r.scanned_at)) : null,
    overallScore: r.overall_score == null ? null : Number(r.overall_score),
    url: `/api/doctor/patients/${patientId}/clinic-reports/${String(r.id)}`,
  }));
}

/** Where a machine report has already been saved, if anywhere. */
export async function findSavedReport(reportKey: string) {
  await ensureMedixoraSchema();
  const res = await db.execute(
    sql`SELECT m.patient_user_id, m.clinic_report_id, u.name FROM medixora_scans m
        JOIN users u ON u.id = m.patient_user_id WHERE m.report_key = ${reportKey}`
  );
  const row = res.rows[0];
  return row
    ? {
        patientId: String(row.patient_user_id),
        reportId: String(row.clinic_report_id),
        patientName: String(row.name),
      }
    : null;
}

/** Fetches the report again, builds the SkinFit PDF and puts it in the patient's history. */
export async function saveMedixoraReport(opts: {
  patientId: string;
  link: string;
  staffId: string;
}): Promise<{ reportId: string; alreadySaved: boolean; withoutText?: boolean }> {
  const patient = await findPatient(opts.patientId);
  if (!patient) throw new MedixoraError("Patient not found.");
  const { key, report } = await fetchMedixoraReport(opts.link);

  const refuseOrReuse = (saved: { patientId: string; reportId: string; patientName: string }) => {
    if (saved.patientId === patient.id) return { reportId: saved.reportId, alreadySaved: true };
    throw new MedixoraError(
      `This report is already saved for ${saved.patientName}. Remove it there first if that was a mistake.`
    );
  };
  const existing = await findSavedReport(key);
  if (existing) return refuseOrReuse(existing);

  const photos = await fetchReportPhotos(report);
  const { content, hasProse } = await buildReportContent(report);
  const pdf = await buildMedixoraPdf({ patient, report, content, photos });
  const title = `Skin Analysis Report - ${formatScanDate(report.scannedAt)}`;
  const storage = getStorage();
  const uploaded = await storage.upload("reports", `skinfit-skin-analysis-${key.slice(0, 12)}.pdf`, pdf, "application/pdf");

  let reportId: string | null = null;
  try {
    reportId = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`medixora:${key}`}))`);
      const taken = await tx.execute(sql`SELECT 1 FROM medixora_scans WHERE report_key = ${key}`);
      if (taken.rows.length > 0) return null;
      const now = new Date();
      const [row] = await tx
        .insert(clinicExternalReports)
        .values({
          doctorId: opts.staffId,
          patientEmail: patient.email?.toLowerCase() ?? null,
          patientName: patient.name,
          patientUserId: patient.id,
          title,
          reportKind: "medixora",
          mimeType: "application/pdf",
          storagePath: uploaded.path,
          status: "sent",
          sentAt: now,
        })
        .returning({ id: clinicExternalReports.id });
      if (!row) throw new Error("report row was not created");
      await tx.execute(
        sql`INSERT INTO medixora_scans (report_key, patient_user_id, clinic_report_id, scanned_at, overall_score, scores, saved_by)
            VALUES (${key}, ${patient.id}, ${row.id}, ${report.scannedAt || null}, ${report.overallScore},
                    ${JSON.stringify(report.scores)}::jsonb, ${opts.staffId})`
      );
      return row.id;
    });
  } catch (e) {
    await storage.delete(uploaded.path).catch(() => {});
    throw e;
  }
  if (!reportId) {
    // Someone saved the same report a moment ago.
    await storage.delete(uploaded.path).catch(() => {});
    const saved = await findSavedReport(key);
    if (saved) return refuseOrReuse(saved);
    throw new MedixoraError("Could not save. Please try again.");
  }

  await invalidateUserHistoryCache(patient.id);
  void sendClinicSupportMessage({
    patientId: patient.id,
    text: "Your clinic skin analysis report is ready. Open History in the app to view it.",
    assistantId: "support",
    doctorId: opts.staffId,
  }).catch((e) => console.warn("medixora chat message failed", e instanceof Error ? e.message : e));

  return { reportId, alreadySaved: false, withoutText: !hasProse };
}

/** Undo for a report saved to the wrong person: removes it from history and deletes the PDF. */
export async function removeMedixoraReport(patientId: string, reportId: string): Promise<boolean> {
  if (!isUuid(patientId) || !isUuid(reportId)) return false;
  await ensureMedixoraSchema();
  const [row] = await db
    .delete(clinicExternalReports)
    .where(
      and(
        eq(clinicExternalReports.id, reportId),
        eq(clinicExternalReports.patientUserId, patientId),
        eq(clinicExternalReports.reportKind, "medixora")
      )
    )
    .returning({ storagePath: clinicExternalReports.storagePath });
  if (!row) return false;
  if (row.storagePath) {
    await getStorage()
      .delete(row.storagePath)
      .catch((e) => console.error("medixora file delete failed", e instanceof Error ? e.message : e));
  }
  await invalidateUserHistoryCache(patientId);
  return true;
}

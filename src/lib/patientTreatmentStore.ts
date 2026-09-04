import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { patientTreatments, users } from "@/src/db/schema";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/src/lib/date-only";
import {
  parseAffectedTreatmentParams,
  type PatientTreatmentRow,
} from "@/src/lib/patientTreatmentRecord";

let ensured: Promise<void> | null = null;

async function ensurePatientTreatmentsTable(): Promise<void> {
  if (!ensured) {
    ensured = db
      .execute(
        sql`
CREATE TABLE IF NOT EXISTS "patient_treatments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "doctor_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "title" varchar(200) NOT NULL,
  "treated_on" date NOT NULL,
  "notes" text,
  "affected_params" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "patient_treatments_patient_idx"
  ON "patient_treatments" ("patient_id", "treated_on");
`
      )
      .then(() => undefined)
      .catch((e) => {
        ensured = null;
        throw e;
      });
  }
  await ensured;
}

function toRow(r: {
  id: string;
  title: string;
  treatedOn: Date;
  notes: string | null;
  affectedParams: string[] | null;
  createdAt: Date;
}): PatientTreatmentRow {
  return {
    id: r.id,
    title: r.title,
    treatedOnYmd: ymdFromDateOnly(r.treatedOn),
    notes: r.notes,
    affectedParams: parseAffectedTreatmentParams(r.affectedParams),
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listPatientTreatments(
  patientId: string
): Promise<PatientTreatmentRow[]> {
  await ensurePatientTreatmentsTable();
  const rows = await db
    .select({
      id: patientTreatments.id,
      title: patientTreatments.title,
      treatedOn: patientTreatments.treatedOn,
      notes: patientTreatments.notes,
      affectedParams: patientTreatments.affectedParams,
      createdAt: patientTreatments.createdAt,
    })
    .from(patientTreatments)
    .where(eq(patientTreatments.patientId, patientId))
    .orderBy(desc(patientTreatments.treatedOn), desc(patientTreatments.createdAt))
    .limit(80);
  return rows.map(toRow);
}

export async function createPatientTreatment(opts: {
  patientId: string;
  doctorId: string;
  title: string;
  treatedOnYmd?: string | null;
  notes?: string | null;
  affectedParams: unknown;
}): Promise<{ ok: true; treatment: PatientTreatmentRow } | { ok: false; error: string }> {
  await ensurePatientTreatmentsTable();
  const title = opts.title.trim().slice(0, 200);
  if (title.length < 2) return { ok: false, error: "TITLE_REQUIRED" };

  const affectedParams = parseAffectedTreatmentParams(opts.affectedParams);
  if (affectedParams.length === 0) {
    return { ok: false, error: "PARAMS_REQUIRED" };
  }

  let ymd = localCalendarYmd();
  if (opts.treatedOnYmd?.trim()) {
    const parsed = parseYmdToDateOnly(opts.treatedOnYmd.trim().slice(0, 10));
    if (!parsed) return { ok: false, error: "INVALID_DATE" };
    ymd = opts.treatedOnYmd.trim().slice(0, 10);
  }

  const notes = opts.notes?.trim().slice(0, 1000) || null;

  const [row] = await db
    .insert(patientTreatments)
    .values({
      patientId: opts.patientId,
      doctorId: opts.doctorId,
      title,
      treatedOn: dateOnlyFromYmd(ymd),
      notes,
      affectedParams,
    })
    .returning({
      id: patientTreatments.id,
      title: patientTreatments.title,
      treatedOn: patientTreatments.treatedOn,
      notes: patientTreatments.notes,
      affectedParams: patientTreatments.affectedParams,
      createdAt: patientTreatments.createdAt,
    });

  if (!row) return { ok: false, error: "INSERT_FAILED" };
  return { ok: true, treatment: toRow(row) };
}

export async function deletePatientTreatment(opts: {
  patientId: string;
  treatmentId: string;
}): Promise<boolean> {
  await ensurePatientTreatmentsTable();
  const deleted = await db
    .delete(patientTreatments)
    .where(
      and(
        eq(patientTreatments.id, opts.treatmentId),
        eq(patientTreatments.patientId, opts.patientId)
      )
    )
    .returning({ id: patientTreatments.id });
  return deleted.length > 0;
}

export async function patientExists(patientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, patientId), eq(users.role, "patient")))
    .limit(1);
  return Boolean(row);
}

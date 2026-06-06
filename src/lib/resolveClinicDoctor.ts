import { eq, or } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { patientDoctorLabel } from "@/src/lib/doctorDisplayName";
import { getDefaultClinicDoctorId } from "@/src/lib/defaultClinicDoctor";
import {
  linkDoctorPatientCare,
  resolveRegisteredStaffUserId,
} from "@/src/lib/doctorPatientCare";

function normalizeDoctorNameKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(dr\.?|doctor)\s+/i, "")
    .replace(/\s+/g, " ");
}

/** Match a CRM / sheet doctor label to a registered staff user id. */
export async function lookupClinicDoctorIdByName(
  name: string | null | undefined
): Promise<string | null> {
  const key = normalizeDoctorNameKey(name ?? "");
  if (!key) return null;

  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(or(eq(users.role, "doctor"), eq(users.role, "admin")));

  for (const row of rows) {
    const rawName = (row.name ?? "").trim();
    if (!rawName) continue;
    const candidates = [
      normalizeDoctorNameKey(rawName),
      normalizeDoctorNameKey(patientDoctorLabel(rawName)),
    ];
    if (candidates.includes(key)) return row.id;
  }
  return null;
}

/** Sheet confirm / assign: payload doctor → request doctor → default clinic doctor. */
export async function resolveClinicDoctorForAppointment(opts: {
  doctorId?: string | null;
  doctorName?: string | null;
  fallbackDoctorId?: string | null;
}): Promise<string | null> {
  const fromId = await resolveRegisteredStaffUserId(opts.doctorId);
  if (fromId) return fromId;

  const fromName = await lookupClinicDoctorIdByName(opts.doctorName);
  if (fromName) return fromName;

  const fallback = await resolveRegisteredStaffUserId(opts.fallbackDoctorId);
  if (fallback) return fallback;

  return getDefaultClinicDoctorId();
}

export async function getClinicDoctorDisplayName(
  doctorId: string | null | undefined
): Promise<string> {
  if (!doctorId) return "Unassigned";
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, doctorId))
    .limit(1);
  return patientDoctorLabel(row?.name, "Unassigned");
}

export async function assignPatientClinicDoctor(
  patientId: string,
  doctorId: string
): Promise<void> {
  await linkDoctorPatientCare(doctorId, patientId, { setAssigned: true });
}

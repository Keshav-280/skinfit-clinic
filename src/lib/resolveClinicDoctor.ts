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

/** Higher = better match for CRM / sheet doctor labels. */
function scoreDoctorNameMatch(key: string, rawName: string): number {
  const normalized = normalizeDoctorNameKey(rawName);
  if (!key || !normalized) return 0;
  if (normalized === key) return 100;
  if (normalized.startsWith(`${key} `)) return 80;
  if (key.startsWith(`${normalized} `)) return 70;
  const keyFirst = key.split(" ")[0] ?? "";
  const nameFirst = normalized.split(" ")[0] ?? "";
  if (keyFirst.length >= 2 && keyFirst === nameFirst) return 50;
  return 0;
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

  let best: { id: string; score: number } | null = null;
  for (const row of rows) {
    const rawName = (row.name ?? "").trim();
    if (!rawName) continue;
    const score = Math.max(
      scoreDoctorNameMatch(key, rawName),
      scoreDoctorNameMatch(key, patientDoctorLabel(rawName))
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { id: row.id, score };
    }
  }
  return best?.id ?? null;
}

/** Sheet confirm / assign: payload doctor → request doctor → default clinic doctor. */
export async function resolveClinicDoctorForAppointment(opts: {
  doctorId?: string | null;
  doctorName?: string | null;
  fallbackDoctorId?: string | null;
  /** When staff picked a doctor in CRM but lookup failed, do not substitute another doctor. */
  strictExplicitDoctor?: boolean;
}): Promise<string | null> {
  const explicitId = opts.doctorId?.trim();
  const explicitName = opts.doctorName?.trim();
  const hadExplicit = Boolean(explicitId || explicitName);

  const fromId = await resolveRegisteredStaffUserId(explicitId);
  if (fromId) return fromId;

  const fromName = await lookupClinicDoctorIdByName(explicitName);
  if (fromName) return fromName;

  if (hadExplicit && opts.strictExplicitDoctor) return null;

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

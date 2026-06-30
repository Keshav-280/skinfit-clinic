import { and, desc, eq, gte, gt } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";

export const DOCTOR_SCAN_INBOX_WINDOW_DAYS = 14;

export type DoctorScanInboxRow = {
  scanId: number;
  patientId: string;
  patientName: string;
  scanName: string | null;
  createdAt: Date;
};

function scanInboxSince(): Date {
  const since = new Date();
  since.setDate(since.getDate() - DOCTOR_SCAN_INBOX_WINDOW_DAYS);
  return since;
}

/** Recent patient scans visible to any doctor in the portal inbox bell. */
export async function loadDoctorScanInbox(
  doctorId: string,
  limit = 25
): Promise<DoctorScanInboxRow[]> {
  const since = scanInboxSince();

  const [staffRow] = await db
    .select({ seenAt: users.doctorPortalScansInboxSeenAt })
    .from(users)
    .where(eq(users.id, doctorId))
    .limit(1);

  const seenAt = staffRow?.seenAt ?? null;

  const rows = await db
    .select({
      scanId: scans.id,
      patientId: scans.userId,
      patientName: users.name,
      scanName: scans.scanName,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .innerJoin(users, eq(scans.userId, users.id))
    .where(
      and(
        eq(users.role, "patient"),
        gte(scans.createdAt, since),
        seenAt ? gt(scans.createdAt, seenAt) : undefined
      )
    )
    .orderBy(desc(scans.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    scanId: r.scanId,
    patientId: r.patientId,
    patientName: r.patientName?.trim() || "Patient",
    scanName: r.scanName,
    createdAt: r.createdAt,
  }));
}

export async function markDoctorScanInboxSeen(doctorId: string): Promise<void> {
  await db
    .update(users)
    .set({ doctorPortalScansInboxSeenAt: new Date() })
    .where(eq(users.id, doctorId));
}

export function postgresErrorCode(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as { code?: string; cause?: { code?: string } };
  return o.code ?? o.cause?.code;
}

export function isMissingDoctorScanInboxColumn(error: unknown): boolean {
  const code = postgresErrorCode(error);
  if (code === "42703") return true;
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message)
      : "";
  return /doctor_portal_scans_inbox_seen_at/i.test(msg);
}

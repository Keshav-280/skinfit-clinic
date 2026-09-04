import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { ensureClinicStaffDoctorInDb } from "@/src/lib/auth/ensureFallbackDoctor";

/**
 * Clinic inbox doctor: always `info@skinfitwellness.in`.
 * Patient visit requests and confirmations land on that account.
 */
export async function getDefaultClinicDoctorId(): Promise<string | null> {
  try {
    return await ensureClinicStaffDoctorInDb();
  } catch (e) {
    console.error("[getDefaultClinicDoctorId] clinic staff", e);
  }

  const envId = process.env.CLINIC_DEFAULT_DOCTOR_ID?.trim();
  if (envId) {
    const row = await db.query.users.findFirst({
      where: eq(users.id, envId),
      columns: { id: true, role: true },
    });
    if (row && (row.role === "doctor" || row.role === "admin")) {
      return row.id;
    }
  }
  const [doc] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "doctor"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  return doc?.id ?? null;
}

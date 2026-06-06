import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";

export const DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_ERROR = "CLINIC_VISIT_REQUIRED";

export const DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE =
  "Doctor chat is available after your first in-clinic visit. Please contact Clinic Support if you need help before then.";

export async function isPatientClinicVisited(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ clinicVisitedAt: users.clinicVisitedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.clinicVisitedAt != null;
}

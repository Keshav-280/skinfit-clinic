import { eq } from "drizzle-orm";
// Worker-safe client: also used by the ml-worker report path.
import { db } from "@/src/db/client";
import { users } from "@/src/db/schema";

export {
  DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_ERROR,
  DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE,
} from "@/src/lib/patientClinicVisitMessages";

export async function isPatientClinicVisited(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ clinicVisitedAt: users.clinicVisitedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.clinicVisitedAt != null;
}

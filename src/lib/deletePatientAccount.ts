import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { parameterScores, scans, users } from "@/src/db/schema";

export async function deletePatientAccount(
  patientId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const patient = await db.query.users.findFirst({
      where: and(eq(users.id, patientId), eq(users.role, "patient")),
      columns: { id: true },
    });
    if (!patient) {
      return { ok: false, error: "NOT_FOUND" };
    }

    await db.transaction(async (tx) => {
      const patientScans = await tx
        .select({ id: scans.id })
        .from(scans)
        .where(eq(scans.userId, patientId));
      const scanIds = patientScans.map((s) => s.id);
      if (scanIds.length > 0) {
        await tx
          .delete(parameterScores)
          .where(inArray(parameterScores.scanId, scanIds));
      }

      const deleted = await tx
        .delete(users)
        .where(and(eq(users.id, patientId), eq(users.role, "patient")))
        .returning({ id: users.id });
      if (deleted.length === 0) {
        throw new Error("USER_DELETE_EMPTY");
      }
    });

    return { ok: true };
  } catch (e) {
    console.error("[deletePatientAccount]", patientId, e);
    return { ok: false, error: "DELETE_FAILED" };
  }
}

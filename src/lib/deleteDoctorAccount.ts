import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointmentRequests,
  appointments,
  chatThreads,
  doctorSlots,
  users,
} from "@/src/db/schema";

const DOCTOR_IMAGE_TABLE = "doctor_profile_images";

export async function deleteDoctorAccount(
  doctorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const doctor = await db.query.users.findFirst({
      where: and(
        eq(users.id, doctorId),
        or(eq(users.role, "doctor"), eq(users.role, "admin"))
      ),
      columns: { id: true },
    });
    if (!doctor) {
      return { ok: false, error: "NOT_FOUND" };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(appointmentRequests)
        .where(eq(appointmentRequests.doctorId, doctorId));

      await tx.delete(appointments).where(eq(appointments.doctorId, doctorId));

      await tx.delete(doctorSlots).where(eq(doctorSlots.doctorId, doctorId));

      await tx.delete(chatThreads).where(eq(chatThreads.doctorId, doctorId));

      await tx
        .update(users)
        .set({
          assignedDoctorId: null,
          doctorFeedbackNote: null,
          doctorFeedbackUpdatedAt: null,
          doctorFeedbackViewedAt: null,
          doctorFeedbackScanVoiceViewedAt: null,
          clinicVisitedAt: null,
        })
        .where(eq(users.assignedDoctorId, doctorId));

      await tx.execute(
        sql`DELETE FROM ${sql.raw(DOCTOR_IMAGE_TABLE)} WHERE owner_user_id = ${doctorId}`
      );

      const deleted = await tx
        .delete(users)
        .where(
          and(
            eq(users.id, doctorId),
            or(eq(users.role, "doctor"), eq(users.role, "admin"))
          )
        )
        .returning({ id: users.id });
      if (deleted.length === 0) {
        throw new Error("USER_DELETE_EMPTY");
      }
    });

    return { ok: true };
  } catch (e) {
    console.error("[deleteDoctorAccount]", doctorId, e);
    return { ok: false, error: "DELETE_FAILED" };
  }
}

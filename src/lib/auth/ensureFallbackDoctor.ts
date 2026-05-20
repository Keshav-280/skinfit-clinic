import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { users } from "@/src/db/schema";
import {
  DOCTOR_FALLBACK_EMAIL,
  DOCTOR_FALLBACK_ID,
  DOCTOR_FALLBACK_NAME,
  DOCTOR_FALLBACK_PASSWORD,
} from "@/src/lib/auth/fallbackDoctorIdentity";

export {
  DOCTOR_FALLBACK_EMAIL,
  DOCTOR_FALLBACK_ID,
  DOCTOR_FALLBACK_NAME,
  DOCTOR_FALLBACK_PASSWORD,
} from "@/src/lib/auth/fallbackDoctorIdentity";

/** Ensures the emergency fallback doctor exists in `users` (required for FK rows like alert acks). */
export async function ensureFallbackDoctorInDb(): Promise<string> {
  const hash = await bcrypt.hash(DOCTOR_FALLBACK_PASSWORD, 10);

  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DOCTOR_FALLBACK_EMAIL))
    .limit(1);

  if (byEmail) {
    await db
      .update(users)
      .set({
        role: "doctor",
        name: DOCTOR_FALLBACK_NAME,
        passwordHash: hash,
      })
      .where(eq(users.id, byEmail.id));
    return byEmail.id;
  }

  await db
    .insert(users)
    .values({
      id: DOCTOR_FALLBACK_ID,
      name: DOCTOR_FALLBACK_NAME,
      email: DOCTOR_FALLBACK_EMAIL,
      passwordHash: hash,
      role: "doctor",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: DOCTOR_FALLBACK_EMAIL,
        name: DOCTOR_FALLBACK_NAME,
        passwordHash: hash,
        role: "doctor",
      },
    });

  return DOCTOR_FALLBACK_ID;
}

export async function resolveStaffUserIdInDb(
  staffId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, staffId))
    .limit(1);
  if (row) return row.id;

  if (staffId === DOCTOR_FALLBACK_ID) {
    try {
      return await ensureFallbackDoctorInDb();
    } catch (e) {
      console.error("[resolveStaffUserIdInDb] ensureFallbackDoctorInDb", e);
      return null;
    }
  }

  return null;
}

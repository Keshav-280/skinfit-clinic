import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { users } from "@/src/db/schema";
import {
  CLINIC_STAFF_EMAIL,
  CLINIC_STAFF_NAME,
  CLINIC_STAFF_PASSWORD,
  DOCTOR_FALLBACK_EMAIL,
  DOCTOR_FALLBACK_ID,
  DOCTOR_FALLBACK_NAME,
  DOCTOR_FALLBACK_PASSWORD,
} from "@/src/lib/auth/fallbackDoctorIdentity";

export {
  CLINIC_STAFF_EMAIL,
  CLINIC_STAFF_NAME,
  CLINIC_STAFF_PASSWORD,
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

/** Ensures info@skinfitwellness.in exists as a doctor and returns that user id. */
export async function ensureClinicStaffDoctorInDb(): Promise<string> {
  const hash = await bcrypt.hash(CLINIC_STAFF_PASSWORD, 10);
  const email = CLINIC_STAFF_EMAIL.toLowerCase();

  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (byEmail) {
    await db
      .update(users)
      .set({
        role: "doctor",
        name: CLINIC_STAFF_NAME,
        email,
        passwordHash: hash,
      })
      .where(eq(users.id, byEmail.id));
    return byEmail.id;
  }

  const [created] = await db
    .insert(users)
    .values({
      name: CLINIC_STAFF_NAME,
      email,
      passwordHash: hash,
      role: "doctor",
    })
    .returning({ id: users.id });

  if (!created?.id) {
    throw new Error("CLINIC_STAFF_CREATE_FAILED");
  }
  return created.id;
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

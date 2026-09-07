import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { loginEvents, users } from "@/src/db/schema";

export type PatientLoginMethod =
  | "password"
  | "otp"
  | "google"
  | "apple"
  | "facebook"
  | "register"
  | "session";

function isMissingLoginTracking(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      (err.message.includes("last_login_at") ||
        err.message.includes("login_events")))
  );
}

/** Best-effort: never block sign-in if the ops columns are not migrated yet. */
export async function recordPatientLogin(input: {
  userId: string;
  method: PatientLoginMethod;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const now = new Date();
    await db
      .update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, input.userId));
    await db.insert(loginEvents).values({
      userId: input.userId,
      method: input.method,
      userAgent: input.userAgent?.slice(0, 500) || null,
    });
  } catch (error) {
    if (isMissingLoginTracking(error)) {
      console.warn(
        "[recordPatientLogin] login tracking columns missing — run drizzle/0058_ops_login_tracking.sql"
      );
      return;
    }
    console.warn("[recordPatientLogin] skipped", error);
  }
}

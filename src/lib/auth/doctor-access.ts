import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { verifySessionToken } from "@/src/lib/auth/session";

const DOCTOR_FALLBACK_EMAIL = "ajaydey1946@gmail.com";
const DOCTOR_FALLBACK_ID = "00000000-0000-0000-0000-000000000001";

/** Staff who may use `/doctor` portal: any doctor or admin. */
export async function getDoctorPortalUserId(): Promise<string | null> {
  const id = await getSessionUserId();
  if (!id) return null;

  let row: { role: string } | undefined;
  try {
    row = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { role: true },
    });
  } catch {
    // DB can be unavailable (e.g. Neon quota). Fall back to verified JWT claims.
    const secret = getSessionSecret();
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!secret || !token) return null;
    try {
      const session = await verifySessionToken(token, secret);
      const roleOk = session.role === "doctor" || session.role === "admin";
      const emailOk = session.email === DOCTOR_FALLBACK_EMAIL;
      const idOk = session.sub === DOCTOR_FALLBACK_ID;
      if (roleOk && emailOk && idOk) return session.sub;
    } catch {
      return null;
    }
    return null;
  }
  if (!row) return null;
  if (row.role === "doctor" || row.role === "admin") return id;
  return null;
}

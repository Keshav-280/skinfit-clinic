import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { verifySessionToken } from "@/src/lib/auth/session";

async function sessionUserIdFromBearerToken(
  bearerHeader: string | null
): Promise<string | null> {
  if (!bearerHeader?.startsWith("Bearer ")) return null;
  const token = bearerHeader.slice(7).trim();
  const secret = getSessionSecret();
  if (!token || !secret) return null;
  try {
    const { sub } = await verifySessionToken(token, secret);
    return sub || null;
  } catch {
    return null;
  }
}

/** Use in Route Handlers so native clients can send `Authorization: Bearer <jwt>`. */
export async function getSessionUserIdFromRequest(
  req: Request
): Promise<string | null> {
  const fromBearer = await sessionUserIdFromBearerToken(
    req.headers.get("authorization")
  );
  if (fromBearer) return fromBearer;
  return getSessionUserId();
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const secret = getSessionSecret();
  if (!token || !secret) return null;
  try {
    const { sub } = await verifySessionToken(token, secret);
    return sub || null;
  } catch {
    return null;
  }
}

export type SessionUserProfile = {
  id: string;
  name: string;
  email: string;
  /** E.g. +91 */
  phoneCountryCode: string;
  /** National digits only (no country code). */
  phone: string | null;
  age: number | null;
  skinType: string | null;
  primaryGoal: string | null;
  /** Hours before a visit to receive a Clinic Support chat reminder; 0 = off. */
  appointmentReminderHoursBefore: number;
};

async function sessionUserProfileById(
  id: string
): Promise<SessionUserProfile | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phoneCountryCode: users.phoneCountryCode,
      phone: users.phone,
      age: users.age,
      skinType: users.skinType,
      primaryGoal: users.primaryGoal,
      appointmentReminderHoursBefore: users.appointmentReminderHoursBefore,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function getSessionUserProfile(): Promise<SessionUserProfile | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  return sessionUserProfileById(id);
}

export async function getSessionUserProfileFromRequest(
  req: Request
): Promise<SessionUserProfile | null> {
  const id = await getSessionUserIdFromRequest(req);
  if (!id) return null;
  return sessionUserProfileById(id);
}

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { verifySessionToken } from "@/src/lib/auth/session";

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
  phone: string | null;
  age: number | null;
  skinType: string | null;
  primaryGoal: string | null;
};

export async function getSessionUserProfile(): Promise<SessionUserProfile | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      age: users.age,
      skinType: users.skinType,
      primaryGoal: users.primaryGoal,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

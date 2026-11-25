import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { isPlaceholderEmail } from "@/src/lib/auth/placeholderEmail";
import {
  getEmailReminderChoice,
  setEmailReminderChoice,
} from "@/src/lib/reminders/emailPrefs";

export const dynamic = "force-dynamic";

async function currentPatient(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) return null;
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

/** choice: true = yes, false = no, null = not asked yet. available: patient with a real email. */
export async function GET(req: Request) {
  try {
    const user = await currentPatient(req);
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const available = user.role === "patient" && !isPlaceholderEmail(user.email);
    return NextResponse.json({
      available,
      email: available ? user.email : null,
      choice: available ? await getEmailReminderChoice(user.id) : null,
    });
  } catch (e) {
    console.error("email reminders GET", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentPatient(req);
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = (await req.json().catch(() => null)) as { optedIn?: unknown } | null;
    if (typeof body?.optedIn !== "boolean") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }
    if (user.role !== "patient" || isPlaceholderEmail(user.email)) {
      return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 400 });
    }
    await setEmailReminderChoice(user.id, body.optedIn);
    return NextResponse.json({ ok: true, choice: body.optedIn });
  } catch (e) {
    console.error("email reminders POST", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

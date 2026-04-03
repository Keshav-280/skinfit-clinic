import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

const MAX_TOKEN_LEN = 512;

/** Accepts Expo push tokens (ExponentPushToken[...] or ExpoPushToken[...]), or null to clear. */
function parseExpoPushToken(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  if (t.length > MAX_TOKEN_LEN) return { ok: false };
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(t)) return { ok: false };
  return { ok: true, value: t };
}

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (!("expoPushToken" in b)) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "expoPushToken is required (string or null)." },
      { status: 400 }
    );
  }

  const parsed = parseExpoPushToken(b.expoPushToken);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "INVALID_TOKEN", message: "Invalid expo push token format." },
      { status: 400 }
    );
  }
  const token = parsed.value;

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.role !== "patient") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await db
    .update(users)
    .set({ expoPushToken: token })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { applyReferralCode } from "@/src/lib/rewards/rewards";
import { REWARD_RULES } from "@/src/lib/rewards/rules";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  INVALID_CODE: 400,
  CODE_NOT_FOUND: 404,
  SELF_REFERRAL: 400,
  ALREADY_REFERRED: 409,
};

/** For accounts created without a code (e.g. Google sign-up): allowed shortly after joining. */
export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const [user] = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const ageDays = (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000;
    if (ageDays > REWARD_RULES.lateReferralWindowDays) {
      return NextResponse.json(
        {
          error: "WINDOW_CLOSED",
          message: `Referral codes can only be added within ${REWARD_RULES.lateReferralWindowDays} days of joining.`,
        },
        { status: 400 }
      );
    }

    const result = await applyReferralCode(userId, body.code);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, message: result.message },
        { status: STATUS[result.code] ?? 400 }
      );
    }
    return NextResponse.json({ ok: true, refereePoints: result.refereePoints });
  } catch (e) {
    console.error("apply referral", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

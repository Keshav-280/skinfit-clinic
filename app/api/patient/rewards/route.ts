import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getRewardsSummary } from "@/src/lib/rewards/rewards";
import { REWARD_RULES } from "@/src/lib/rewards/rules";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const summary = await getRewardsSummary(userId);
    return NextResponse.json({
      ok: true,
      ...summary,
      rules: {
        referrerPoints: REWARD_RULES.referrerPoints,
        refereePoints: REWARD_RULES.refereePoints,
        googleReviewPoints: REWARD_RULES.googleReviewPoints,
        minBillToRedeem: REWARD_RULES.minBillToRedeem,
      },
    });
  } catch (e) {
    console.error("rewards summary", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Could not load rewards." },
      { status: 500 }
    );
  }
}

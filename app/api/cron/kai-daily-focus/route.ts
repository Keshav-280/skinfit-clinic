import { NextResponse } from "next/server";
import { runDailyFocusJob } from "@/src/lib/cronKaiJobs";

export const dynamic = "force-dynamic";

function authorizeCron(req: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  if (expected) return auth === `Bearer ${expected}`;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const out = await runDailyFocusJob();
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "CRON_FAILED" }, { status: 500 });
  }
}

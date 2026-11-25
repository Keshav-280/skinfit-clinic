import { NextResponse } from "next/server";
import { runWeeklyReminders, sendWeeklyReminderTest } from "@/src/lib/runWeeklyReminders";

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
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET must be set in production." },
      { status: 500 }
    );
  }

  try {
    // ?testEmail=you@example.com sends one sample to that account only.
    const testEmail = new URL(req.url).searchParams.get("testEmail");
    if (testEmail !== null) {
      return NextResponse.json({ ok: true, test: await sendWeeklyReminderTest(testEmail) });
    }
    const out = await runWeeklyReminders();
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.error("weekly-reminders cron", e);
    return NextResponse.json({ error: "CRON_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

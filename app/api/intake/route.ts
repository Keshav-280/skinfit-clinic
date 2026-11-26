import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { establishPatientSessionCookie } from "@/src/lib/auth/oauth/establish-session";
import { ensureSignupSourcesSchema } from "@/src/lib/attribution/signupSource";
import { getCache } from "@/src/lib/infra";
import { intakeErrors, sanitizeIntake } from "@/src/lib/intake/form";
import { saveIntake } from "@/src/lib/intake/store";

export const dynamic = "force-dynamic";

/** A whole clinic shares one network address, so the limit is generous but not open-ended. */
const SUBMISSIONS_PER_IP_PER_HOUR = 40;

async function overLimit(ip: string): Promise<boolean> {
  try {
    const key = `intake:ip:${ip}`;
    const n = (await getCache().get<number>(key)) ?? 0;
    if (n >= SUBMISSIONS_PER_IP_PER_HOUR) return true;
    await getCache().set(key, n + 1, 3600);
  } catch {
    /* the cache being down must not stop patients registering */
  }
  return false;
}

/** Public: the clinic patient form. Submitting it creates the patient account and signs them in. */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 20_000) {
      return NextResponse.json({ error: "TOO_LARGE", message: "The form is too long." }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "INVALID_JSON", message: "Invalid request." }, { status: 400 });
    }
    const answers = sanitizeIntake(body);
    const errors = intakeErrors(answers);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "INVALID_FORM", message: errors[0]!.message, errors },
        { status: 400 }
      );
    }

    const staffUserId = await getDoctorPortalUserId();
    if (!staffUserId) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      if (ip && (await overLimit(ip))) {
        return NextResponse.json(
          { error: "RATE_LIMITED", message: "Too many forms from this network. Please ask the front desk." },
          { status: 429 }
        );
      }
    }

    const result = await saveIntake({
      answers,
      sessionUserId: staffUserId ? null : await getSessionUserId(),
      staffUserId,
    });

    if (result.kind === "created") {
      try {
        await ensureSignupSourcesSchema();
        await db.execute(
          sql`INSERT INTO signup_sources (user_id, source) VALUES (${result.user.id}, 'clinic-form')
              ON CONFLICT (user_id) DO NOTHING`
        );
      } catch (e) {
        console.error("intake signup source", e);
      }
    }

    // Staff typing a form on their own device stay signed in as staff.
    if (staffUserId) {
      return NextResponse.json({ ok: true, outcome: "staff", patientId: result.user.id, existed: result.kind === "existing" });
    }
    if (result.kind === "existing") {
      return NextResponse.json({ ok: true, outcome: "existing" });
    }
    const session = await establishPatientSessionCookie(result.user, {
      method: result.kind === "created" ? "register" : "session",
      userAgent: req.headers.get("user-agent"),
    });
    if ("error" in session) {
      return NextResponse.json({ error: "SERVER_MISCONFIGURED", message: session.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, outcome: "signed-in" });
  } catch (e) {
    // Never log the body: it holds medical history.
    console.error("intake submit", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Could not save the form. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import {
  generateInitialReportContent,
  generateUpdateReportContent,
} from "@/src/lib/report/generateReportContent";

export const runtime = "nodejs";
export const maxDuration = 25;

type Body = {
  mode?: "initial" | "update";
  patientInfo?: unknown;
  currentScan?: unknown;
  previousScan?: unknown;
  weeklyCheckIn?: unknown;
  environmentData?: unknown;
  clinicRecord?: unknown;
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode === "initial" ? "initial" : "update";

  if (mode === "initial") {
    const payload = {
      patient: body.patientInfo ?? {},
      current_scan: body.currentScan ?? {},
    };
    const { report, aiUnavailable } = await generateInitialReportContent(payload);
    return NextResponse.json({
      ok: true,
      mode,
      aiUnavailable,
      report: report ?? null,
    });
  }

  const payload = {
    patient: body.patientInfo ?? {},
    current_scan: body.currentScan ?? {},
    previous_scan: body.previousScan ?? {},
    weekly_checkin: body.weeklyCheckIn ?? {},
    environment: body.environmentData ?? {},
    clinic_record: body.clinicRecord ?? {},
  };

  const { report, aiUnavailable } = await generateUpdateReportContent(payload);
  return NextResponse.json({
    ok: true,
    mode,
    aiUnavailable,
    report: report ?? null,
  });
}

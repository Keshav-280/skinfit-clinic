import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { buildPatientTrackerReport } from "@/src/lib/patientTrackerReport";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scanIdRaw = searchParams.get("scanId");
  const scanId = scanIdRaw ? Number.parseInt(scanIdRaw, 10) : NaN;
  const dateParam = searchParams.get("date");

  const built = await buildPatientTrackerReport({
    userId,
    scanId,
    dateParam,
  });

  if (!built.ok) {
    if (built.error === "INVALID_SCAN_ID") {
      return NextResponse.json({ error: "INVALID_SCAN_ID" }, { status: 400 });
    }
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(built.report);
}

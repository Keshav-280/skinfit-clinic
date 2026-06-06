import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getPatientProgressSnapshot } from "@/src/lib/patientProgressMilestones";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const progress = await getPatientProgressSnapshot(userId);
  return NextResponse.json(progress);
}

import { NextResponse } from "next/server";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";

/** Returns 403 if not clinic staff; otherwise null (caller may proceed). */
export async function requireAnnotatorAuth(
  request: Request
): Promise<NextResponse | null> {
  const staffId = await getDoctorPortalUserIdFromRequest(request);
  if (staffId) return null;

  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}

import { NextResponse } from "next/server";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

/** Returns 401/403 if not clinic staff; otherwise null (caller may proceed). */
export async function requireAnnotatorAuth(
  request: Request
): Promise<NextResponse | null> {
  const staffId = await getDoctorPortalUserIdFromRequest(request);
  if (staffId) return null;

  const userId = await getSessionUserIdFromRequest(request);
  if (userId) {
    return NextResponse.json(
      { error: "Forbidden", message: "Clinic staff access required." },
      { status: 403 }
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

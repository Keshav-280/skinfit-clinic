import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { listRegisteredClinicDoctors } from "@/src/lib/doctorPatientCare";

/** All clinic doctors/admins the patient can open a chat thread with. */
export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const doctors = await listRegisteredClinicDoctors();

  return NextResponse.json({
    doctors,
    /** @deprecated use doctors[0] */
    profile: doctors[0]
      ? { id: doctors[0].id, name: doctors[0].name, email: doctors[0].email }
      : null,
  });
}

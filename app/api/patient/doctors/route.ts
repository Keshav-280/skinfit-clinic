import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { listRegisteredClinicDoctors } from "@/src/lib/doctorPatientCare";
import {
  DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE,
  isPatientClinicVisited,
} from "@/src/lib/patientClinicVisit";

/** All clinic doctors/admins the patient can open a chat thread with. */
export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [doctors, clinicVisited] = await Promise.all([
    listRegisteredClinicDoctors(),
    isPatientClinicVisited(userId),
  ]);

  return NextResponse.json({
    doctors,
    clinicVisited,
    doctorChatEnabled: clinicVisited,
    doctorChatDisabledMessage: clinicVisited
      ? null
      : DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE,
    /** @deprecated use doctors[0] */
    profile: doctors[0]
      ? { id: doctors[0].id, name: doctors[0].name, email: doctors[0].email }
      : null,
  });
}

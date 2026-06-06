import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  getAssignedDoctorIdForPatient,
  listRegisteredClinicDoctors,
} from "@/src/lib/doctorPatientCare";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import { patientDoctorLabel } from "@/src/lib/doctorDisplayName";
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

  const [doctorsRaw, clinicVisited, assignedDoctorId] = await Promise.all([
    listRegisteredClinicDoctors(),
    isPatientClinicVisited(userId),
    getAssignedDoctorIdForPatient(userId),
  ]);

  const doctors = doctorsRaw.map((d) => ({
    id: d.id,
    name: patientDoctorLabel(d.name),
    email: d.email,
    photoUrl: publicFileDisplayUrl(d.photoUrl) ?? null,
  }));

  return NextResponse.json({
    doctors,
    assignedDoctorId,
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

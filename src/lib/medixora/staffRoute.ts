import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { MedixoraError } from "@/src/lib/medixora/fetch";

/** Every Medixora portal route: clinic staff only, and errors that never echo links or patient data. */
export async function staffOnly(
  label: string,
  handler: (staffId: string) => Promise<Response>
): Promise<Response> {
  try {
    const staffId = await getDoctorPortalUserId();
    if (!staffId) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in again." }, { status: 401 });
    }
    return await handler(staffId);
  } catch (e) {
    if (e instanceof MedixoraError) {
      return NextResponse.json({ error: "MEDIXORA", message: e.message }, { status: 400 });
    }
    console.error(label, e instanceof Error ? e.message : "unknown error");
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

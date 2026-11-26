import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getSessionUserId } from "@/src/lib/auth/get-session";

const denied = () => NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

/** For route handlers: returns a 401 response unless a doctor or admin is signed in. */
export async function requireStaff(): Promise<NextResponse | null> {
  return (await getDoctorPortalUserId()) ? null : denied();
}

/** For route handlers: returns a 401 response unless someone is signed in. */
export async function requireSignedIn(): Promise<NextResponse | null> {
  return (await getSessionUserId()) ? null : denied();
}

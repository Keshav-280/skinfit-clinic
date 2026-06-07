import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { listBuiltInClinicTreatments } from "@/src/lib/clinicTreatmentGuides";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const treatments = listBuiltInClinicTreatments().map((t) => ({
    id: t.id,
    name: t.name,
    preCare: t.preCare,
    postCareDos: t.postCareDos,
    postCareDonts: t.postCareDonts,
    isBuiltIn: true,
  }));

  return NextResponse.json({ treatments });
}

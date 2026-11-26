import { NextResponse } from "next/server";
import { staffOnly } from "@/src/lib/medixora/staffRoute";
import { PATIENT_PAGE, searchPatients } from "@/src/lib/medixora/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return staffOnly("medixora patients", async () => {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const patients = await searchPatients(q);
    return NextResponse.json({ patients, limited: patients.length === PATIENT_PAGE });
  });
}

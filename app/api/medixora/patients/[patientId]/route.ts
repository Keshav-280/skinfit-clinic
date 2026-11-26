import { NextResponse } from "next/server";
import { staffOnly } from "@/src/lib/medixora/staffRoute";
import { findPatient, listMedixoraReports } from "@/src/lib/medixora/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  return staffOnly("medixora patient", async () => {
    const patient = await findPatient((await ctx.params).patientId);
    if (!patient) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Patient not found." }, { status: 404 });
    }
    return NextResponse.json({ patient, reports: await listMedixoraReports(patient.id) });
  });
}

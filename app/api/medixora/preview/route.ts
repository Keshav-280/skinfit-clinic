import { NextResponse } from "next/server";
import { fetchMedixoraReport } from "@/src/lib/medixora/fetch";
import { nameMatch } from "@/src/lib/medixora/report";
import { staffOnly } from "@/src/lib/medixora/staffRoute";
import { findPatient, findSavedReport } from "@/src/lib/medixora/store";

export const runtime = "nodejs";

/** Reads a scanned report and shows it. Nothing is saved yet. */
export async function POST(req: Request) {
  return staffOnly("medixora preview", async () => {
    const body = (await req.json().catch(() => null)) as { patientId?: unknown; link?: unknown } | null;
    const link = typeof body?.link === "string" ? body.link.slice(0, 2000) : "";
    const patient = await findPatient(typeof body?.patientId === "string" ? body.patientId : "");
    if (!patient || !link) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Choose a patient and scan the QR." }, { status: 400 });
    }
    const { key, report } = await fetchMedixoraReport(link);
    const saved = await findSavedReport(key);
    return NextResponse.json({
      report,
      match: nameMatch(report.customer.name, patient.name),
      saved: saved ? { samePatient: saved.patientId === patient.id, patientName: saved.patientName } : null,
    });
  });
}

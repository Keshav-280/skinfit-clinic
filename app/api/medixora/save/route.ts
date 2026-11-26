import { NextResponse } from "next/server";
import { staffOnly } from "@/src/lib/medixora/staffRoute";
import { saveMedixoraReport } from "@/src/lib/medixora/store";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Builds the SkinFit PDF and adds it to the patient's history. */
export async function POST(req: Request) {
  return staffOnly("medixora save", async (staffId) => {
    const body = (await req.json().catch(() => null)) as { patientId?: unknown; link?: unknown } | null;
    const link = typeof body?.link === "string" ? body.link.slice(0, 2000) : "";
    const patientId = typeof body?.patientId === "string" ? body.patientId : "";
    if (!patientId || !link) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Choose a patient and scan the QR." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await saveMedixoraReport({ patientId, link, staffId })) });
  });
}

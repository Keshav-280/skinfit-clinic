import { NextResponse } from "next/server";
import { staffOnly } from "@/src/lib/medixora/staffRoute";
import { removeMedixoraReport } from "@/src/lib/medixora/store";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ patientId: string; reportId: string }> }
) {
  return staffOnly("medixora remove", async (staffId) => {
    const { patientId, reportId } = await ctx.params;
    const removed = await removeMedixoraReport(patientId, reportId);
    if (!removed) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Report not found." }, { status: 404 });
    }
    console.info("medixora report removed", { reportId, staffId });
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { listIntakeForms } from "@/src/lib/intake/store";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Staff only: the patient's submitted clinic forms (medical history). */
export async function GET(_req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  try {
    if (!(await getDoctorPortalUserId())) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { patientId } = await ctx.params;
    if (!UUID.test(patientId)) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ forms: await listIntakeForms(patientId) });
  } catch (e) {
    console.error("intake list", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

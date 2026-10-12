import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { voidClinicBill } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ billId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { billId } = await ctx.params;
  try {
    const result = await voidClinicBill(billId, staffId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, message: result.message },
        { status: result.code === "NOT_FOUND" ? 404 : 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("void bill", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Could not void the bill." }, { status: 500 });
  }
}

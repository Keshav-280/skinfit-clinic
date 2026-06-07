import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { applyWalletTopUp } from "@/src/lib/familyWallet";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;

  const [patient] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, patientId))
    .limit(1);
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: { amountCredits?: number; note?: string };
  try {
    body = (await req.json()) as { amountCredits?: number; note?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const amount =
    typeof body.amountCredits === "number"
      ? Math.round(body.amountCredits)
      : NaN;

  const result = await applyWalletTopUp({
    patientUserId: patientId,
    amountCredits: amount,
    performedByUserId: staffId,
    note: body.note,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    balanceAfter: result.balanceAfter,
  });
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getRewardsSummary, listPatientBills } from "@/src/lib/rewards/rewards";
import { REWARD_RULES } from "@/src/lib/rewards/rules";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { patientId } = await ctx.params;

  try {
    const [patient] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneCountryCode: users.phoneCountryCode,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.id, patientId), eq(users.role, "patient")))
      .limit(1);
    if (!patient) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Patient not found." }, { status: 404 });
    }

    const [summary, bills] = await Promise.all([
      getRewardsSummary(patientId),
      listPatientBills(patientId),
    ]);
    return NextResponse.json({
      ok: true,
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone ? `${patient.phoneCountryCode} ${patient.phone}` : null,
      },
      summary,
      bills,
      rules: { minBillToRedeem: REWARD_RULES.minBillToRedeem, earnRate: REWARD_RULES.spendEarnRate },
    });
  } catch (e) {
    console.error("rewards patient", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Could not load patient." }, { status: 500 });
  }
}

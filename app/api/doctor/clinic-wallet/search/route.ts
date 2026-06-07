import { NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getWalletMembershipForUser } from "@/src/lib/familyWallet";

export async function GET(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  const pattern = `%${q}%`;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "patient"),
        or(ilike(users.name, pattern), ilike(users.email, pattern))
      )
    )
    .limit(12);

  const patients = await Promise.all(
    rows
      .filter((r) => r.email)
      .map(async (r) => {
        const membership = await getWalletMembershipForUser(r.id);
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          balanceCredits: membership?.balanceCredits ?? 0,
        };
      })
  );

  return NextResponse.json({ patients });
}

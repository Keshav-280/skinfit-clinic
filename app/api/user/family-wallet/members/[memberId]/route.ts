import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { removeFamilyMember } from "@/src/lib/familyWallet";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ memberId: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { memberId } = await ctx.params;
  if (!memberId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const result = await removeFamilyMember({
    ownerUserId: userId,
    memberUserId: memberId,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

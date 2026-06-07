import { NextResponse } from "next/server";
import { verifyFamilyLinkOtp } from "@/src/lib/auth/familyLinkOtp";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  findPatientByEmail,
  getOrCreateWalletForUser,
  linkFamilyMember,
} from "@/src/lib/familyWallet";

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { email?: string; otp?: string };
  try {
    body = (await req.json()) as { email?: string; otp?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!email || !otp) {
    return NextResponse.json(
      { message: "Email and verification code are required." },
      { status: 400 }
    );
  }

  const membership = await getOrCreateWalletForUser(userId);
  if (membership.role !== "owner") {
    return NextResponse.json(
      { message: "Only the family card holder can link members." },
      { status: 403 }
    );
  }

  const invitee = await findPatientByEmail(email);
  if (!invitee) {
    return NextResponse.json(
      { message: "No patient account found with that email." },
      { status: 404 }
    );
  }

  const verified = await verifyFamilyLinkOtp({
    inviterUserId: userId,
    inviteeEmail: email,
    code: otp,
  });
  if (!verified.ok) {
    return NextResponse.json({ message: verified.message }, { status: 400 });
  }

  const linked = await linkFamilyMember({
    ownerUserId: userId,
    inviteeUserId: invitee.id,
  });
  if (!linked.ok) {
    return NextResponse.json({ message: linked.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `${invitee.name} has been added to your family card.`,
  });
}

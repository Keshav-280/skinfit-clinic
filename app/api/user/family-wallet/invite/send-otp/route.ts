import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { sendFamilyLinkOtp } from "@/src/lib/auth/familyLinkOtp";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  findPatientByEmail,
  getOrCreateWalletForUser,
} from "@/src/lib/familyWallet";

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json(
      { message: "Enter the family member's email." },
      { status: 400 }
    );
  }

  const membership = await getOrCreateWalletForUser(userId);
  if (membership.role !== "owner") {
    return NextResponse.json(
      { message: "Only the family card holder can invite members." },
      { status: 403 }
    );
  }

  const invitee = await findPatientByEmail(email);
  if (!invitee) {
    return NextResponse.json(
      {
        message:
          "No patient account found with that email. They need to register first.",
      },
      { status: 404 }
    );
  }

  if (invitee.id === userId) {
    return NextResponse.json(
      { message: "You cannot link your own email." },
      { status: 400 }
    );
  }

  const [inviter] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const result = await sendFamilyLinkOtp({
    inviterUserId: userId,
    inviterName: inviter?.name ?? "A family member",
    inviteeEmail: email,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.message,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: result.retryAfterSeconds ? 429 : 400 }
    );
  }

  return NextResponse.json({
    message: result.message,
    cooldownSeconds: result.cooldownSeconds,
  });
}

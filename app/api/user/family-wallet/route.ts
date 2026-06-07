import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getFamilyWalletSnapshot } from "@/src/lib/familyWallet";

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const snapshot = await getFamilyWalletSnapshot(userId);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("[family-wallet GET]", err);
    return NextResponse.json(
      { message: "Could not load family card. Please try again shortly." },
      { status: 500 }
    );
  }
}

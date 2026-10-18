import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { deletePatientAccount } from "@/src/lib/deletePatientAccount";

/** Patient self-service account deletion (Play Store / App Store requirement). */
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { confirm?: unknown };
  try {
    body = (await req.json()) as { confirm?: unknown };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });
  if (!user || user.role !== "patient") {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }

  const result = await deletePatientAccount(userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "NOT_FOUND" ? 404 : 500 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}

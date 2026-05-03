import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { chatThreads } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export async function POST(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const patientId =
    body &&
    typeof body === "object" &&
    typeof (body as { patientId?: unknown }).patientId === "string"
      ? (body as { patientId: string }).patientId.trim()
      : "";
  if (!patientId) {
    return NextResponse.json({ error: "MISSING_patientId" }, { status: 400 });
  }

  const now = new Date();
  const [row] = await db
    .update(chatThreads)
    .set({ doctorPortalLastReadAt: now })
    .where(
      and(eq(chatThreads.userId, patientId), eq(chatThreads.assistantId, "doctor"))
    )
    .returning({ id: chatThreads.id });

  if (!row) {
    return NextResponse.json({ ok: false, error: "THREAD_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

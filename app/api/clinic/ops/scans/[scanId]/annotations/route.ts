import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { parseSuppressedAnnotationPoses } from "@/src/lib/parseClinicalScores";

const POSES = new Set(["centre", "left", "right", "smiling", "eyes_closed"]);

/** Staff: hide (or show again) the annotated photo of one pose from the patient. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).scanId);
  const body = (await req.json().catch(() => null)) as {
    pose?: string;
    hidden?: boolean;
  } | null;
  if (!Number.isInteger(id) || !body?.pose || !POSES.has(body.pose) || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const row = await db.query.scans.findFirst({
    where: eq(scans.id, id),
    columns: { scores: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = new Set(parseSuppressedAnnotationPoses(row.scores));
  if (body.hidden) current.add(body.pose);
  else current.delete(body.pose);

  const scores = { ...((row.scores ?? {}) as Record<string, unknown>) };
  scores.annotationSuppressed = Array.from(current);
  await db
    .update(scans)
    .set({ scores: scores as typeof row.scores })
    .where(eq(scans.id, id));

  return NextResponse.json({ ok: true, hidden: Array.from(current) });
}

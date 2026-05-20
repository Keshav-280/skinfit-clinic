import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  monthlyReports,
  scans,
  skinScans,
  users,
  weeklyReports,
} from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

const REPORT_KINDS = ["weekly", "monthly", "legacy-scan", "scan"] as const;
type ReportKind = (typeof REPORT_KINDS)[number];

function isReportKind(v: unknown): v is ReportKind {
  return typeof v === "string" && (REPORT_KINDS as readonly string[]).includes(v);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: { kind?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isReportKind(body.kind)) {
    return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
  }
  if (body.id == null || String(body.id).trim() === "") {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const kind = body.kind;
  const idRaw = String(body.id).trim();

  try {
    switch (kind) {
      case "weekly": {
        const deleted = await db
          .delete(weeklyReports)
          .where(
            and(eq(weeklyReports.id, idRaw), eq(weeklyReports.userId, patientId))
          )
          .returning({ id: weeklyReports.id });
        if (deleted.length === 0) {
          return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }
        break;
      }
      case "monthly": {
        const deleted = await db
          .delete(monthlyReports)
          .where(
            and(eq(monthlyReports.id, idRaw), eq(monthlyReports.userId, patientId))
          )
          .returning({ id: monthlyReports.id });
        if (deleted.length === 0) {
          return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }
        break;
      }
      case "legacy-scan": {
        const deleted = await db
          .delete(skinScans)
          .where(and(eq(skinScans.id, idRaw), eq(skinScans.userId, patientId)))
          .returning({ id: skinScans.id });
        if (deleted.length === 0) {
          return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }
        break;
      }
      case "scan": {
        const scanId = Number.parseInt(idRaw, 10);
        if (!Number.isFinite(scanId)) {
          return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
        }
        const deleted = await db
          .delete(scans)
          .where(and(eq(scans.id, scanId), eq(scans.userId, patientId)))
          .returning({ id: scans.id });
        if (deleted.length === 0) {
          return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[doctor/patients/reports DELETE]", e);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}

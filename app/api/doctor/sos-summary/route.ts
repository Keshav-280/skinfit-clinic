import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export const dynamic = "force-dynamic";
import {
  filterUnackedSosRows,
  loadAckedSosMessageIdsForStaff,
  loadLatestUrgentSosPerPatientSince,
} from "@/src/lib/doctorSosInbox";

const SOS_WINDOW_DAYS = 14;

function snippetFromMessage(text: string, maxLen = 100): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export async function GET() {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const since = subDays(new Date(), SOS_WINDOW_DAYS);
  const [latest, ackedIds] = await Promise.all([
    loadLatestUrgentSosPerPatientSince(since),
    loadAckedSosMessageIdsForStaff(staffId),
  ]);

  const unacked = filterUnackedSosRows(latest, ackedIds);
  unacked.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const items = unacked.slice(0, 12).map((r) => ({
    patientId: r.patientId,
    messageId: r.messageId,
    patientName: r.patientName,
    preview: snippetFromMessage(r.text),
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json(
    {
      success: true,
      patientCount: unacked.length,
      items,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

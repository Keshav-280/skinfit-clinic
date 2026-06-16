import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  isMissingDoctorScanInboxColumn,
  loadDoctorScanInbox,
} from "@/src/lib/doctorScanInbox";

export async function GET() {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const rows = await loadDoctorScanInbox(staffId, 25);
    const items = rows.map((r) => ({
      scanId: r.scanId,
      patientId: r.patientId,
      patientName: r.patientName,
      scanName: r.scanName,
      preview: r.scanName?.trim() || `Scan #${r.scanId}`,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (e) {
    if (isMissingDoctorScanInboxColumn(e)) {
      return NextResponse.json({ success: true, count: 0, items: [] });
    }
    throw e;
  }
}

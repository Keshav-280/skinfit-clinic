import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  isMissingDoctorScanInboxColumn,
  markDoctorScanInboxSeen,
} from "@/src/lib/doctorScanInbox";

export async function POST() {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await markDoctorScanInboxSeen(staffId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingDoctorScanInboxColumn(e)) {
      return NextResponse.json({ ok: true });
    }
    throw e;
  }
}

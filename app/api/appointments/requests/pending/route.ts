import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { appointmentRequests, doctorSlots, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { ymdFromDateOnly } from "@/src/lib/date-only";

export async function GET(req: Request) {
  const sessionUserId = await getSessionUserIdFromRequest(req);
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");
  if (!doctorId) return NextResponse.json({ error: "doctorId_required" }, { status: 400 });

  // Pending requests for doctor (clinic approval queue).
  const rows = await db
    .select({
      id: appointmentRequests.id,
      patientId: appointmentRequests.patientId,
      issue: appointmentRequests.issue,
      why: appointmentRequests.why,
      status: appointmentRequests.status,
      createdAt: appointmentRequests.createdAt,
      slotId: doctorSlots.id,
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(appointmentRequests)
    .innerJoin(doctorSlots, eq(appointmentRequests.doctorSlotId, doctorSlots.id))
    .innerJoin(users, eq(appointmentRequests.patientId, users.id))
    .where(
      and(
        eq(appointmentRequests.doctorId, doctorId),
        eq(appointmentRequests.status, "pending")
      )
    )
    .orderBy(desc(appointmentRequests.createdAt), asc(doctorSlots.slotTimeHm))
    .limit(200);

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patient: { name: r.patientName, email: r.patientEmail },
      issue: r.issue,
      why: r.why,
      status: r.status,
      slot: {
        id: r.slotId,
        slotDate: ymdFromDateOnly(r.slotDate),
        slotTimeHm: r.slotTimeHm,
        slotEndTimeHm: r.slotEndTimeHm ?? null,
      },
      createdAt: r.createdAt,
    })),
  });
}


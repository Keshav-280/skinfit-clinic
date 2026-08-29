import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { DoctorPatientDetailClient } from "@/components/doctor/DoctorPatientDetailClient";

type Props = { params: Promise<{ patientId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { patientId } = await params;
  const row = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { name: true, primaryConcern: true },
  });

  if (!row) {
    return { title: "Patient" };
  }

  const concern = row.primaryConcern ? ` · ${row.primaryConcern}` : "";
  return {
    title: `${row.name}${concern}`,
    description: `SkinFit Wellness patient chart for ${row.name}. Review scans, routines, appointments, and clinical notes.`,
  };
}

export default async function DoctorPatientDetailPage({ params }: Props) {
  const { patientId } = await params;
  return <DoctorPatientDetailClient patientId={patientId} />;
}

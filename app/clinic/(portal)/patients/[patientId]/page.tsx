import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { DoctorSimplePatientDetail } from "@/components/doctor/DoctorSimplePatientDetail";

type Props = { params: Promise<{ patientId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { patientId } = await params;
  const row = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { name: true },
  });
  return { title: row?.name?.trim() || "Patient" };
}

export default async function ClinicPatientDetailPage({ params }: Props) {
  const { patientId } = await params;
  return <DoctorSimplePatientDetail patientId={patientId} />;
}

import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { listRegisteredClinicDoctors } from "@/src/lib/doctorPatientCare";

const DOCTOR_IMAGE_TABLE = "doctor_profile_images";

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

async function ensureDoctorImageTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.raw(DOCTOR_IMAGE_TABLE)} (
      owner_user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      image_url text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getDoctorImageByUserId(userId: string): Promise<string> {
  await ensureDoctorImageTable();
  const result = await db.execute(
    sql`SELECT image_url FROM ${sql.raw(DOCTOR_IMAGE_TABLE)} WHERE owner_user_id = ${userId} LIMIT 1`
  );
  const rows = rowsFromExecute<{ image_url?: string | null }>(result);
  return rows[0]?.image_url?.trim() || "";
}

/** Patient chat doctor profile: latest configured doctor/admin identity (no Ruby hardcode). */
export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const doctors = await listRegisteredClinicDoctors();
  if (doctors.length === 0) {
    return NextResponse.json({ profile: null, doctors: [] });
  }

  const specialtyRows = await db
    .select({ id: users.id, specialty: users.primaryGoal })
    .from(users)
    .where(inArray(users.id, doctors.map((d) => d.id)));
  const specialtyById = new Map(
    specialtyRows.map((r) => [r.id, (r.specialty ?? "").trim()])
  );

  const doctor = doctors[0];

  const imageUrl = await getDoctorImageByUserId(doctor.id);

  return NextResponse.json({
    doctors: await Promise.all(
      doctors.map(async (d) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        imageUrl: await getDoctorImageByUserId(d.id),
        specialty: specialtyById.get(d.id) ?? "",
      }))
    ),
    profile: {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      specialty: specialtyById.get(doctor.id) ?? "",
      imageUrl,
    },
  });
}

import { NextResponse } from "next/server";
import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

const DOCTOR_FALLBACK_EMAIL = "ajaydey1946@gmail.com";
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

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 1) Prefer the fallback doctor row when present, since portal edits are made there.
  let [doctor] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      specialty: users.primaryGoal,
    })
    .from(users)
    .where(eq(users.email, DOCTOR_FALLBACK_EMAIL))
    .limit(1);

  // 2) Else fall back to latest real doctor/admin row.
  if (!doctor) {
    [doctor] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        specialty: users.primaryGoal,
      })
      .from(users)
      .where(or(eq(users.role, "doctor"), eq(users.role, "admin"))!)
      .orderBy(desc(users.createdAt))
      .limit(1);
  }

  if (!doctor) {
    return NextResponse.json({ profile: null });
  }
  const imageUrl = await getDoctorImageByUserId(doctor.id);

  return NextResponse.json({
    profile: {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      specialty: doctor.specialty ?? "",
      imageUrl,
    },
  });
}

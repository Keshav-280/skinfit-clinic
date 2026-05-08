import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { verifySessionToken } from "@/src/lib/auth/session";

const DOCTOR_FALLBACK_EMAIL = "ajaydey1946@gmail.com";
const DOCTOR_FALLBACK_ID = "00000000-0000-0000-0000-000000000001";
const DOCTOR_FALLBACK_NAME = "Dr. Ajay Dey";
const DOCTOR_FALLBACK_PASSWORD = "12345678";
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

async function upsertDoctorImageByUserId(userId: string, imageUrl: string): Promise<void> {
  await ensureDoctorImageTable();
  await db.execute(sql`
    INSERT INTO ${sql.raw(DOCTOR_IMAGE_TABLE)} (owner_user_id, image_url, updated_at)
    VALUES (${userId}, ${imageUrl}, now())
    ON CONFLICT (owner_user_id)
    DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = now()
  `);
}

async function fallbackSessionProfile() {
  const secret = getSessionSecret();
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!secret || !token) return null;
  try {
    const session = await verifySessionToken(token, secret);
    const isFallback =
      (session.role === "doctor" || session.role === "admin") &&
      session.email === DOCTOR_FALLBACK_EMAIL &&
      session.sub === DOCTOR_FALLBACK_ID;
    if (!isFallback) return null;
    return {
      id: session.sub || DOCTOR_FALLBACK_ID,
      name: session.name || DOCTOR_FALLBACK_NAME,
      email: session.email || DOCTOR_FALLBACK_EMAIL,
      specialty: "",
      imageUrl: "",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const doctorUserId = await getDoctorPortalUserId();
  if (!doctorUserId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, doctorUserId),
    columns: {
      id: true,
      name: true,
      email: true,
      primaryGoal: true,
    },
  });
  if (!row && doctorUserId === DOCTOR_FALLBACK_ID) {
    const fallbackRow = await db.query.users.findFirst({
      where: eq(users.email, DOCTOR_FALLBACK_EMAIL),
      columns: {
        id: true,
        name: true,
        email: true,
        primaryGoal: true,
      },
    });
    if (fallbackRow) {
      const imageUrl = await getDoctorImageByUserId(fallbackRow.id);
      return NextResponse.json({
        profile: {
          id: fallbackRow.id,
          name: fallbackRow.name,
          email: fallbackRow.email,
          specialty: fallbackRow.primaryGoal ?? "",
          imageUrl,
        },
      });
    }
  }
  if (!row && doctorUserId === DOCTOR_FALLBACK_ID) {
    const fallback = await fallbackSessionProfile();
    if (fallback) {
      return NextResponse.json({ profile: fallback });
    }
  }
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const imageUrl = await getDoctorImageByUserId(row.id);

  return NextResponse.json({
    profile: {
      id: row.id,
      name: row.name,
      email: row.email,
      specialty: row.primaryGoal ?? "",
      imageUrl,
    },
  });
}

export async function PATCH(req: Request) {
  const doctorUserId = await getDoctorPortalUserId();
  if (!doctorUserId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const updates: {
    name?: string;
    primaryGoal?: string | null;
  } = {};
  let hasImageUpdate = false;
  let nextImageUrl = "";

  if (typeof body.name === "string") {
    const v = body.name.trim().slice(0, 255);
    if (!v) return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    updates.name = v;
  }

  if ("specialty" in body) {
    if (body.specialty === null || body.specialty === "") {
      updates.primaryGoal = null;
    } else if (typeof body.specialty === "string") {
      updates.primaryGoal = body.specialty.trim().slice(0, 255) || null;
    } else {
      return NextResponse.json({ error: "INVALID_SPECIALTY" }, { status: 400 });
    }
  }

  if ("imageUrl" in body) {
    if (typeof body.imageUrl !== "string") {
      return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
    }
    hasImageUpdate = true;
    nextImageUrl = body.imageUrl.trim().slice(0, 900_000);
  }

  if (Object.keys(updates).length === 0 && !hasImageUpdate) {
    return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
  }

  let resolvedUserId: string | null = null;
  const updated = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, doctorUserId))
    .returning({ id: users.id });
  if (updated.length > 0) resolvedUserId = updated[0]?.id ?? null;

  if (updated.length === 0 && doctorUserId === DOCTOR_FALLBACK_ID) {
    // Fallback staff session may map to an older row by email; update that first.
    const fallbackUpdated = await db
      .update(users)
      .set(updates)
      .where(eq(users.email, DOCTOR_FALLBACK_EMAIL))
      .returning({ id: users.id });
    if (fallbackUpdated.length > 0) {
      resolvedUserId = fallbackUpdated[0]?.id ?? null;
      if (hasImageUpdate && resolvedUserId) {
        await upsertDoctorImageByUserId(resolvedUserId, nextImageUrl);
      }
      return NextResponse.json({ ok: true, persisted: true, updatedByEmail: true });
    }

    // Otherwise create a dedicated DB row so edits persist.
    try {
      const passwordHash = await bcrypt.hash(DOCTOR_FALLBACK_PASSWORD, 10);
      await db.insert(users).values({
        id: DOCTOR_FALLBACK_ID,
        name: updates.name ?? DOCTOR_FALLBACK_NAME,
        email: DOCTOR_FALLBACK_EMAIL,
        passwordHash,
        role: "doctor",
        primaryGoal: updates.primaryGoal ?? null,
        onboardingComplete: true,
      });
      resolvedUserId = DOCTOR_FALLBACK_ID;
      if (hasImageUpdate) {
        await upsertDoctorImageByUserId(DOCTOR_FALLBACK_ID, nextImageUrl);
      }
      return NextResponse.json({ ok: true, persisted: true, created: true });
    } catch {
      return NextResponse.json({ ok: true, persisted: false });
    }
  }

  if (hasImageUpdate && resolvedUserId) {
    await upsertDoctorImageByUserId(resolvedUserId, nextImageUrl);
  }

  return NextResponse.json({ ok: true });
}

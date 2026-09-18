import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import { isAnnotatorDevBypass, requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { getSessionUserProfileFromRequest } from "@/src/lib/auth/get-session";

async function profileFor(req: Request) {
  const profile = await getSessionUserProfileFromRequest(req);
  if (profile) return profile;
  return isAnnotatorDevBypass() ? { id: "dev-local", name: "Local dev" } : null;
}

/** Separate annotator_state row from the polygon annotator ("default"). */
const MARKS_SCOPE = "marks";

const MARK_CATEGORIES = ["acne_scar", "dark_spot", "mole", "active_acne"] as const;
type MarkCategory = (typeof MARK_CATEGORIES)[number];

/** Circle in normalized image coords; r is a fraction of image width. */
type MarkCircle = {
  id: string;
  imageIndex: number;
  fileName: string;
  category: MarkCategory;
  cx: number;
  cy: number;
  r: number;
  iw: number;
  ih: number;
};

const MAX_CIRCLES = 20_000;

function isFiniteIn01(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function sanitizeCircles(input: unknown): MarkCircle[] | null {
  if (!Array.isArray(input) || input.length > MAX_CIRCLES) return null;
  const out: MarkCircle[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    if (
      typeof c.id !== "string" ||
      !c.id ||
      c.id.length > 64 ||
      !Number.isInteger(c.imageIndex) ||
      (c.imageIndex as number) < 0 ||
      typeof c.fileName !== "string" ||
      !MARK_CATEGORIES.includes(c.category as MarkCategory) ||
      !isFiniteIn01(c.cx) ||
      !isFiniteIn01(c.cy) ||
      typeof c.r !== "number" ||
      !Number.isFinite(c.r) ||
      c.r <= 0 ||
      c.r > 0.5 ||
      !Number.isInteger(c.iw) ||
      !Number.isInteger(c.ih) ||
      (c.iw as number) <= 0 ||
      (c.ih as number) <= 0
    ) {
      return null;
    }
    out.push({
      id: c.id,
      imageIndex: c.imageIndex as number,
      fileName: c.fileName.slice(0, 255),
      category: c.category as MarkCategory,
      cx: c.cx,
      cy: c.cy,
      r: c.r,
      iw: c.iw as number,
      ih: c.ih as number,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;
  const profile = await profileFor(req);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const merged = new URL(req.url).searchParams.get("merged") === "1";

  if (merged) {
    const result = await db.execute<{ user_id: string; circle: MarkCircle }>(sql`
      SELECT u.key AS user_id, circle
      FROM annotator_state s,
           jsonb_each(s.per_user_shapes) AS u(key, shapes),
           jsonb_array_elements(u.shapes) AS circle
      WHERE s.scope = ${MARKS_SCOPE}
    `);
    return NextResponse.json({
      success: true,
      circles: (result.rows ?? []).map((r) => ({ ...r.circle, userId: r.user_id })),
    });
  }

  const result = await db.execute<{ circles: MarkCircle[] | null; updated_at: Date | null }>(sql`
    SELECT per_user_shapes->${profile.id} AS circles, updated_at
    FROM annotator_state
    WHERE scope = ${MARKS_SCOPE}
    LIMIT 1
  `);
  const row = result.rows[0];
  return NextResponse.json({
    success: true,
    circles: Array.isArray(row?.circles) ? row.circles : [],
    updatedAt: row?.updated_at ?? null,
    currentUser: { id: profile.id, name: profile.name },
  });
}

export async function PUT(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;
  const profile = await profileFor(req);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { circles?: unknown } | null;
  const circles = sanitizeCircles(body?.circles);
  if (!circles) return NextResponse.json({ error: "INVALID_CIRCLES" }, { status: 400 });

  const json = JSON.stringify(circles);
  // Write only this user's key so concurrent annotators never clobber each other.
  await db.execute(sql`
    INSERT INTO annotator_state (scope, per_user_shapes)
    VALUES (${MARKS_SCOPE}, jsonb_build_object(${profile.id}::text, ${json}::jsonb))
    ON CONFLICT (scope) DO UPDATE SET
      per_user_shapes = jsonb_set(
        coalesce(annotator_state.per_user_shapes, '{}'::jsonb),
        ARRAY[${profile.id}]::text[], ${json}::jsonb, true),
      updated_at = now()
  `);
  return NextResponse.json({ success: true, count: circles.length });
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

const MAX_PHOTO_BYTES = 500_000; // ~500KB data URI

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { profilePhotoUrl: true },
  });
  return NextResponse.json({ profilePhotoUrl: user?.profilePhotoUrl ?? null });
}

export async function PUT(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { dataUri } = body as { dataUri?: string };
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) {
    return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  }
  if (dataUri.length > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE", message: "Photo must be under 500 KB." }, { status: 400 });
  }

  await db.update(users).set({ profilePhotoUrl: dataUri }).where(eq(users.id, userId));

  return NextResponse.json({ ok: true, profilePhotoUrl: dataUri });
}

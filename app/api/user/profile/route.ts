import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { createSessionToken } from "@/src/lib/auth/session";
import { validateRegistrationPhone } from "@/src/lib/auth/phone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.role !== "patient") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  let nextName = user.name;
  let nextEmail = user.email;
  let nextPhone: string | null = user.phone;
  let nextAge: number | null = user.age;
  let nextSkin: string | null = user.skinType;
  let nextGoal: string | null = user.primaryGoal;

  if (typeof body.name === "string") {
    const n = body.name.trim().slice(0, 255);
    if (!n) {
      return NextResponse.json(
        { message: "Name cannot be empty." },
        { status: 400 }
      );
    }
    nextName = n;
  }

  if (typeof body.email === "string") {
    const raw = body.email.trim();
    if (!EMAIL_REGEX.test(raw)) {
      return NextResponse.json(
        { message: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    const normalized = raw.toLowerCase();
    if (normalized !== user.email.toLowerCase()) {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalized))
        .limit(1);
      if (taken) {
        return NextResponse.json(
          { message: "That email is already in use." },
          { status: 409 }
        );
      }
    }
    nextEmail = normalized;
  }

  if ("phone" in body) {
    if (typeof body.phone !== "string") {
      return NextResponse.json(
        { message: "Invalid phone number." },
        { status: 400 }
      );
    }
    const phoneCheck = validateRegistrationPhone(body.phone);
    if (!phoneCheck.ok) {
      return NextResponse.json({ message: phoneCheck.message }, { status: 400 });
    }
    nextPhone = phoneCheck.value;
  }

  if ("age" in body) {
    if (body.age === null) {
      nextAge = null;
    } else if (
      typeof body.age === "number" &&
      Number.isFinite(body.age)
    ) {
      nextAge = Math.min(120, Math.max(1, Math.round(body.age)));
    } else if (body.age !== undefined) {
      return NextResponse.json(
        { message: "Age must be a number between 1 and 120, or empty." },
        { status: 400 }
      );
    }
  }

  if ("skinType" in body) {
    if (body.skinType === null || body.skinType === "") {
      nextSkin = null;
    } else if (typeof body.skinType === "string") {
      nextSkin = body.skinType.trim().slice(0, 100) || null;
    } else {
      return NextResponse.json(
        { message: "Invalid skin type." },
        { status: 400 }
      );
    }
  }

  if ("primaryGoal" in body) {
    if (body.primaryGoal === null || body.primaryGoal === "") {
      nextGoal = null;
    } else if (typeof body.primaryGoal === "string") {
      nextGoal = body.primaryGoal.trim().slice(0, 255) || null;
    } else {
      return NextResponse.json(
        { message: "Invalid primary goal." },
        { status: 400 }
      );
    }
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  let nextHash = user.passwordHash;
  if (newPassword || currentPassword) {
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { message: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (!currentPassword) {
      return NextResponse.json(
        { message: "Enter your current password to set a new one." },
        { status: 400 }
      );
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { message: "Current password is incorrect." },
        { status: 401 }
      );
    }
    nextHash = await bcrypt.hash(newPassword, 10);
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 }
    );
  }

  await db
    .update(users)
    .set({
      name: nextName,
      email: nextEmail,
      age: nextAge,
      skinType: nextSkin,
      primaryGoal: nextGoal,
      passwordHash: nextHash,
    })
    .where(eq(users.id, userId));

  const token = await createSessionToken(
    {
      id: user.id,
      email: nextEmail,
      role: user.role,
      name: nextName,
    },
    secret
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: nextName,
      email: nextEmail,
      phone: nextPhone,
      age: nextAge,
      skinType: nextSkin,
      primaryGoal: nextGoal,
    },
  });
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { createSessionToken } from "@/src/lib/auth/session";
import { validateRegistrationPhone } from "@/src/lib/auth/phone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_NAME = 255;

export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone : "";

  const phoneCheck = validateRegistrationPhone(phoneRaw);
  if (!phoneCheck.ok) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: phoneCheck.message },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: "NAME_REQUIRED", message: "Please enter your name." },
      { status: 400 }
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "EMAIL_REQUIRED", message: "Please enter your email." },
      { status: 400 }
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      {
        error: "INVALID_EMAIL",
        message: "Please enter a valid email address.",
      },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      {
        error: "PASSWORD_TOO_SHORT",
        message: `Password must be at least ${MIN_PASSWORD} characters.`,
      },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error: "EMAIL_TAKEN",
        message: "An account with this email already exists. Try signing in.",
      },
      { status: 409 }
    );
  }

  const secret = getSessionSecret();
  if (!secret) {
    console.error(
      "SESSION_SECRET must be set to at least 32 characters in production."
    );
    return NextResponse.json(
      {
        error: "SERVER_MISCONFIGURED",
        message: "Server configuration error.",
      },
      { status: 500 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [inserted] = await db
    .insert(users)
    .values({
      name,
      email: normalizedEmail,
      phone: phoneCheck.value,
      passwordHash,
      role: "patient",
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    });

  if (!inserted) {
    return NextResponse.json(
      { error: "CREATE_FAILED", message: "Could not create account." },
      { status: 500 }
    );
  }

  const token = await createSessionToken(
    {
      id: inserted.id,
      email: inserted.email,
      role: inserted.role,
      name: inserted.name,
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
      id: inserted.id,
      email: inserted.email,
      name: inserted.name,
      phone: phoneCheck.value,
    },
  });
}

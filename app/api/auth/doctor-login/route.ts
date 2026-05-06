import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { createSessionToken } from "@/src/lib/auth/session";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOCTOR_FALLBACK_EMAIL = "ajaydey1946@gmail.com";
const DOCTOR_FALLBACK_PASSWORD = "12345678";
const DOCTOR_FALLBACK_ID = "00000000-0000-0000-0000-000000000001";
const DOCTOR_FALLBACK_NAME = "Dr. Ajay Dey";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !EMAIL_REGEX.test(email) || !password) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Email and password required." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();
  const isFallbackDoctorLogin =
    normalizedEmail === DOCTOR_FALLBACK_EMAIL &&
    password === DOCTOR_FALLBACK_PASSWORD;

  // Emergency fallback when DB quota/connectivity blocks staff sign-in.
  if (isFallbackDoctorLogin) {
    const secret = getSessionSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "SERVER_CONFIG", message: "Session not configured." },
        { status: 500 }
      );
    }

    const token = await createSessionToken(
      {
        id: DOCTOR_FALLBACK_ID,
        email: DOCTOR_FALLBACK_EMAIL,
        role: "doctor",
        name: DOCTOR_FALLBACK_NAME,
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
      success: true,
      user: {
        id: DOCTOR_FALLBACK_ID,
        name: DOCTOR_FALLBACK_NAME,
        email: DOCTOR_FALLBACK_EMAIL,
        role: "doctor",
      },
    });
  }

  let user:
    | {
        id: string;
        name: string;
        email: string;
        role: string;
        passwordHash: string;
      }
    | undefined;
  try {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
  } catch (e) {
    console.error("[auth/doctor-login]", e);
    return NextResponse.json(
      {
        error: "DB_UNAVAILABLE",
        message:
          "Database is temporarily unavailable. Use fallback doctor credentials for now.",
      },
      { status: 503 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "USER_NOT_FOUND", message: "No account with that email." },
      { status: 401 }
    );
  }

  if (user.role !== "doctor" && user.role !== "admin") {
    return NextResponse.json(
      {
        error: "NOT_STAFF",
        message: "This sign-in is for clinic staff only.",
      },
      { status: 403 }
    );
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS", message: "Incorrect email or password." },
      { status: 401 }
    );
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "SERVER_CONFIG", message: "Session not configured." },
      { status: 500 }
    );
  }

  const token = await createSessionToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
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
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

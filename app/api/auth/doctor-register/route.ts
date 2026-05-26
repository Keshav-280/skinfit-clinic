import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { authCookieSecure } from "@/src/lib/auth/cookieSecure";
import { createSessionToken } from "@/src/lib/auth/session";
import { getDoctorRegistrationSecret } from "@/src/lib/doctorPatientCare";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_NAME = 255;

export async function POST(req: Request) {
  const configuredSecret = getDoctorRegistrationSecret();
  if (!configuredSecret) {
    return NextResponse.json(
      {
        error: "SERVER_CONFIG",
        message:
          "Doctor registration is not configured. Set DOCTOR_REGISTRATION_SECRET_KEY in the environment.",
      },
      { status: 503 }
    );
  }

  let body: {
    name?: string;
    email?: string;
    password?: string;
    secretKey?: string;
  };
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
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const secretKey =
    typeof body.secretKey === "string" ? body.secretKey.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "NAME_REQUIRED", message: "Please enter your name." },
      { status: 400 }
    );
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "Please enter a valid email address." },
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
  if (!secretKey) {
    return NextResponse.json(
      { error: "SECRET_KEY_REQUIRED", message: "Registration secret key is required." },
      { status: 400 }
    );
  }
  if (secretKey !== configuredSecret) {
    return NextResponse.json(
      { error: "INVALID_SECRET_KEY", message: "Invalid registration secret key." },
      { status: 403 }
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "EMAIL_IN_USE", message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: "doctor",
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    });

  if (!created?.id) {
    return NextResponse.json(
      { error: "CREATE_FAILED", message: "Could not create doctor account." },
      { status: 500 }
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
      id: created.id,
      email: created.email,
      role: created.role,
      name: created.name,
    },
    secret
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true, userId: created.id });
}

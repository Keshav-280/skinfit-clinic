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

function loginFailureMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/expo_push_token|column .* does not exist/i.test(msg)) {
    return "Database is out of date. Run migrations (add expo_push_token to users), then try again.";
  }
  if (/connect|ECONNREFUSED|database/i.test(msg)) {
    return "Cannot reach the database. Check DATABASE_URL and that Postgres is running.";
  }
  return "Something went wrong on the server. Please try again.";
}

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
  if (!password) {
    return NextResponse.json(
      { error: "PASSWORD_REQUIRED", message: "Please enter your password." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          error: "USER_NOT_FOUND",
          message: "We couldn't find an account with that email.",
        },
        { status: 401 }
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json(
        {
          error: "INVALID_CREDENTIALS",
          message: "Incorrect email or password.",
        },
        { status: 401 }
      );
    }

    if (user.role !== "patient") {
      return NextResponse.json(
        {
          error: "NOT_PATIENT",
          message: "This portal is for patients only.",
        },
        { status: 403 }
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

    const nativeClient = req.headers.get("x-skinfit-client") === "native";
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      ...(nativeClient ? { token } : {}),
    });
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: loginFailureMessage(e),
      },
      { status: 500 }
    );
  }
}

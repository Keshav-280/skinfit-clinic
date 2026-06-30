import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { jwtVerify } from "jose";

import { db } from "@/src/db";
import { mobileCaptureSessions, users } from "@/src/db/schema";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { authCookieSecure } from "@/src/lib/auth/cookieSecure";
import { createSessionToken } from "@/src/lib/auth/session";
import { getSessionSecret } from "@/src/lib/auth/session-secret";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("s");
  const token = url.searchParams.get("t");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!sessionId || !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "Server authentication error." },
      { status: 500 }
    );
  }

  let userId = "";
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (payload.purpose !== "mobile-capture") throw new Error("wrong token purpose");
    userId = typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [session] = await db
    .select()
    .from(mobileCaptureSessions)
    .where(eq(mobileCaptureSessions.id, sessionId))
    .limit(1);

  if (
    !session ||
    session.userId !== userId ||
    session.token !== token ||
    new Date() > new Date(session.expiresAt)
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.status !== "complete" || session.scanId == null) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const sessionToken = await createSessionToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? "",
    },
    secret
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL(next, request.url));
}

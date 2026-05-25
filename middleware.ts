import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";

const onboardingSql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : null;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = getSessionSecret();

  if (!token || !secret) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );
    const sub = typeof payload.sub === "string" ? payload.sub : null;

    if (sub && onboardingSql) {
      const rows = (await onboardingSql`
        select
          u.onboarding_complete,
          exists (
            select 1 from scans s
            where s.user_id = u.id
              and s.scan_name = ${BASELINE_ONBOARDING_SCAN_NAME}
          ) as has_baseline_scan
        from users u
        where u.id = ${sub}::uuid
        limit 1
      `) as { onboarding_complete: boolean; has_baseline_scan: boolean }[];
      const row = rows[0];
      const complete = row?.onboarding_complete ?? true;
      const hasBaseline = row?.has_baseline_scan ?? false;
      const canAccess = complete || hasBaseline;
      if (!canAccess) {
        const allowed = /^\/dashboard\/history\/scans\/[^/]+$/.test(pathname);
        if (!allowed) {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
      }
    }

    return NextResponse.next();
  } catch {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};

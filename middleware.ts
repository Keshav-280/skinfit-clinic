import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";

function isAnnotatorPage(pathname: string): boolean {
  if (pathname.startsWith("/annotator/categories/")) return false;
  return pathname === "/annotator" || pathname.startsWith("/annotator/");
}

function isStaffRole(role: unknown): boolean {
  return role === "doctor" || role === "admin";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public help images (stored in public/annotator/categories/)
  if (pathname.startsWith("/annotator/categories/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = getSessionSecret();
  const annotatorPage = isAnnotatorPage(pathname);
  const loginPath = annotatorPage ? "/doctor/login" : "/login";

  if (!token || !secret) {
    const login = new URL(loginPath, request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (annotatorPage && !isStaffRole(payload.role)) {
      const login = new URL("/doctor/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  } catch {
    const login = new URL(loginPath, request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/annotator",
    "/annotator/:path*",
  ],
};

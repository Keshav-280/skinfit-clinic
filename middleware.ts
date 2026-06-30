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

function annotatorNotAllowed(): NextResponse {
  return new NextResponse("Not allowed", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public help images (stored in public/annotator/categories/)
  if (pathname.startsWith("/annotator/categories/")) {
    return NextResponse.next();
  }

  const annotatorPage = isAnnotatorPage(pathname);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = getSessionSecret();

  if (annotatorPage) {
    if (!token || !secret) return annotatorNotAllowed();
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      if (!isStaffRole(payload.role)) return annotatorNotAllowed();
      return NextResponse.next();
    } catch {
      return annotatorNotAllowed();
    }
  }

  if (!token || !secret) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return NextResponse.next();
  } catch {
    const login = new URL("/login", request.url);
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

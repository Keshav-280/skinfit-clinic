import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { doctorPortalLoginUrl } from "@/src/lib/auth/doctor-portal-next";
import { getSessionSecret } from "@/src/lib/auth/session-secret";

function isAnnotatorPage(pathname: string): boolean {
  if (pathname.startsWith("/annotator/categories/")) return false;
  return pathname === "/annotator" || pathname.startsWith("/annotator/");
}

function isDoctorProtectedPath(pathname: string): boolean {
  if (pathname === "/skinfit-report-generator") return true;
  if (!pathname.startsWith("/doctor/")) return false;
  if (pathname === "/doctor/login" || pathname === "/doctor/signup") return false;
  if (pathname === "/doctor") return false;
  return true;
}

function doctorProtectedReturnPath(pathname: string): string {
  if (pathname === "/skinfit-report-generator") {
    return "/doctor/clinic-reports?tab=generate";
  }
  return pathname;
}

function isStaffRole(role: unknown): boolean {
  return role === "doctor" || role === "admin";
}

function forwardWithPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public help images (stored in public/annotator/categories/)
  if (pathname.startsWith("/annotator/categories/")) {
    return NextResponse.next();
  }

  const annotatorPage = isAnnotatorPage(pathname);
  const doctorProtected = isDoctorProtectedPath(pathname);
  const patientProtected =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    annotatorPage;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = getSessionSecret();

  if (doctorProtected) {
    const returnPath = doctorProtectedReturnPath(pathname);

    if (!token || !secret) {
      return NextResponse.redirect(doctorPortalLoginUrl(request.url, returnPath));
    }

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      if (!isStaffRole(payload.role)) {
        return NextResponse.redirect(doctorPortalLoginUrl(request.url, returnPath));
      }
      if (pathname === "/skinfit-report-generator") {
        return NextResponse.redirect(
          new URL("/doctor/clinic-reports?tab=generate", request.url)
        );
      }
      return forwardWithPathname(request, pathname);
    } catch {
      return NextResponse.redirect(doctorPortalLoginUrl(request.url, returnPath));
    }
  }

  if (!patientProtected) {
    return NextResponse.next();
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
    "/doctor/:path*",
    "/skinfit-report-generator",
  ],
};

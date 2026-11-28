import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REVIEW_COOKIE, reviewSignIn } from "@/src/lib/skinReview/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const result = await reviewSignIn(
    typeof body?.email === "string" ? body.email.slice(0, 200) : "",
    typeof body?.password === "string" ? body.password.slice(0, 200) : "",
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ message: result.message }, { status: result.status });
}

export async function DELETE() {
  (await cookies()).delete(REVIEW_COOKIE);
  return NextResponse.json({ ok: true });
}

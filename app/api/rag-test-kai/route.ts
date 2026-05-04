import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { users } from "@/src/db/schema";
import { DEMO_LOGIN_EMAIL } from "@/src/lib/auth/demo-login";
import { generateRagKaiOutput } from "@/src/lib/ragKaiTestService";
import { loadTextbookChunks } from "@/src/lib/ragTextbookIndex";
import { seedRagKaiDemoData } from "@/src/db/seed-rag-kai-demo";

// Long timeout because /generate may do ~20 LLM calls.
export const maxDuration = 300;

function forbidInProd() {
  return process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  if (forbidInProd()) {
    return NextResponse.json({ ok: false, error: "DISABLED_IN_PRODUCTION" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "generate";
  const demoOnly = searchParams.get("demo") !== "0";
  const email = searchParams.get("email") ?? DEMO_LOGIN_EMAIL;

  if (action === "stats") {
    const chunks = loadTextbookChunks();
    return NextResponse.json({
      ok: true,
      textbook: { chunks: chunks.length },
    });
  }

  if (action === "seed") {
    const seeded = await seedRagKaiDemoData();
    return NextResponse.json({ ok: true, seeded });
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND", email },
      { status: 404 }
    );
  }
  if (demoOnly && user.email !== DEMO_LOGIN_EMAIL) {
    return NextResponse.json(
      { ok: false, error: "ONLY_DEMO_ALLOWED" },
      { status: 403 }
    );
  }

  const output = await generateRagKaiOutput({ userId: user.id });
  if (!output) {
    return NextResponse.json(
      { ok: false, error: "INSUFFICIENT_DATA" },
      { status: 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    output,
  });
}

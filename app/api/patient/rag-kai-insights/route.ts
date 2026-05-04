import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { generateRagKaiOutput } from "@/src/lib/ragKaiTestService";

/** On-demand RAG + textbook-backed kAI package (daily focus, per-scan, monthly μ-parameters). */
export const maxDuration = 300;

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const output = await generateRagKaiOutput({ userId });
  if (!output) {
    return NextResponse.json(
      { error: "INSUFFICIENT_DATA", message: "Complete at least one skin scan to generate insights." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, output });
}

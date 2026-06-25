import { NextResponse } from "next/server";

/** Bumped when annotator client protocol changes; old tabs auto-reload on next check. */
export const ANNOTATOR_CLIENT_MIN_VERSION = 2;

export async function GET() {
  return NextResponse.json(
    { minVersion: ANNOTATOR_CLIENT_MIN_VERSION },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { after, NextResponse } from "next/server";
import {
  requestScanRetake,
  reviewCase,
  saveReviewDraft,
  submitStaffReview,
} from "@/src/lib/scanReview/review";
import { reviewersOnly } from "@/src/lib/skinReview/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return reviewersOnly("skin review case", async () => {
    const found = await reviewCase((await ctx.params).id);
    return found
      ? NextResponse.json(found)
      : NextResponse.json({ message: "Scan not found." }, { status: 404 });
  });
}

/** Saves unfinished work. */
export async function PUT(req: Request, ctx: Ctx) {
  return reviewersOnly("skin review draft", async () => {
    await saveReviewDraft((await ctx.params).id, await req.json().catch(() => null));
    return NextResponse.json({ ok: true });
  });
}

/** Final submit, or ask the patient to take the scan again. */
export async function POST(req: Request, ctx: Ctx) {
  return reviewersOnly("skin review action", async () => {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const reviewer = typeof body?.reviewer === "string" ? body.reviewer : "";
    if (body?.action === "submit") {
      const { scanId, announce } = await submitStaffReview({
        id,
        reviewer,
        scores: body.scores,
        shapes: body.shapes,
        note: body.note,
      });
      console.info("staff review submitted", { reviewId: id, scanId });
      // The written report takes a few minutes; the patient is told once it is there.
      after(() => announce().catch((e) => console.error("staff review announce", e instanceof Error ? e.message : e)));
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "retake") {
      await requestScanRetake({ id, reviewer, reason: typeof body.reason === "string" ? body.reason : "" });
      console.info("staff review retake", { reviewId: id });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ message: "Choose submit or retake." }, { status: 400 });
  });
}

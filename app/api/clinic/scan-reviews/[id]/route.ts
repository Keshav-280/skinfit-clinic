import { after, NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { approveScanReview, requestScanRetake, ReviewError } from "@/src/lib/scanReview/review";

export const runtime = "nodejs";
export const maxDuration = 300;

const POSES = new Set(["centre", "left", "right", "smiling", "eyes_closed"]);

/** Staff only: release a held scan to the patient, or ask for a retake. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const staffId = await getDoctorPortalUserId();
    if (!staffId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as {
      action?: unknown;
      hiddenPoses?: unknown;
      reason?: unknown;
    } | null;

    if (body?.action === "approve") {
      const hiddenPoses = (Array.isArray(body.hiddenPoses) ? body.hiddenPoses : []).filter(
        (p): p is string => typeof p === "string" && POSES.has(p)
      );
      const { scanId, announce } = await approveScanReview({ id, staffId, hiddenPoses });
      console.info("scan review approved", { reviewId: id, scanId, staffId });
      // The written report takes a few minutes; the patient is told once it is there.
      after(() => announce().catch((e) => console.error("scan review announce", e instanceof Error ? e.message : e)));
      return NextResponse.json({ ok: true, scanId });
    }
    if (body?.action === "retake") {
      await requestScanRetake({ id, staffId, reason: typeof body.reason === "string" ? body.reason : "" });
      console.info("scan review retake", { reviewId: id, staffId });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "BAD_REQUEST", message: "Choose approve or retake." }, { status: 400 });
  } catch (e) {
    if (e instanceof ReviewError) {
      return NextResponse.json({ error: "REVIEW", message: e.message }, { status: 409 });
    }
    console.error("scan review action", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}

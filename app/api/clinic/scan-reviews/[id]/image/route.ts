import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { scanImageNextResponse } from "@/src/lib/scanImageHttpResponse";
import { getScanReview } from "@/src/lib/scanReview/review";

export const runtime = "nodejs";

/** Staff only: a held scan's photo (`i`), or its marked version for one view (`marked`). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getDoctorPortalUserId())) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const review = await getScanReview((await ctx.params).id);
    const values = review?.pending?.scanValues;
    if (!values) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const query = new URL(req.url).searchParams;
    const marked = query.get("marked");
    if (marked) {
      const byPose = (values.scores as { spotAnnotatedByPose?: Record<string, string> } | null)
        ?.spotAnnotatedByPose;
      const url = byPose && Object.hasOwn(byPose, marked) ? byPose[marked] : undefined;
      if (!url) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      return scanImageNextResponse({ imageUrl: url, faceCaptureImages: undefined, index: 0, preview: false });
    }
    return scanImageNextResponse({
      imageUrl: values.imageUrl,
      faceCaptureImages: values.faceCaptureImages as never,
      index: Number.parseInt(query.get("i") ?? "0", 10) || 0,
      preview: false,
    });
  } catch (e) {
    console.error("scan review image", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

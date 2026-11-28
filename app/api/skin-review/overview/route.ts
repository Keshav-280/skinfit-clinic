import { NextResponse } from "next/server";
import { listWaitingReviews, searchReviewPatients } from "@/src/lib/scanReview/review";
import { reviewersOnly } from "@/src/lib/skinReview/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return reviewersOnly("skin review overview", async () => {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const [waiting, patients] = await Promise.all([listWaitingReviews(), searchReviewPatients(q)]);
    return NextResponse.json({ waiting, patients });
  });
}

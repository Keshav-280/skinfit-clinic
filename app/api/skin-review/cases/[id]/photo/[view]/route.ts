import { NextResponse } from "next/server";
import { reviewPhoto } from "@/src/lib/scanReview/review";
import { reviewersOnly } from "@/src/lib/skinReview/auth";
import { VIEWS } from "@/src/lib/staffReview/model";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; view: string }> }) {
  return reviewersOnly("skin review photo", async () => {
    const { id, view } = await ctx.params;
    const wanted = VIEWS.find((v) => v === view);
    const photo = wanted ? await reviewPhoto(id, wanted) : null;
    return photo ?? NextResponse.json({ message: "No photo." }, { status: 404 });
  });
}

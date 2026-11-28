import { SkinReviewHome } from "@/components/skinReview/SkinReviewHome";
import { SkinReviewLogin } from "@/components/skinReview/SkinReviewLogin";
import { isReviewSignedIn, reviewLoginConfigured } from "@/src/lib/skinReview/auth";
import { REVIEW_HOURS } from "@/src/lib/staffReview/model";

export const dynamic = "force-dynamic";

export default async function SkinReviewPage() {
  if (!(await isReviewSignedIn())) return <SkinReviewLogin configured={reviewLoginConfigured()} />;
  return <SkinReviewHome reviewHours={REVIEW_HOURS} />;
}

import { redirect } from "next/navigation";

/** Scans are now scored and sent from the skin review pages. */
export default function ScanReviewsMoved() {
  redirect("/skin-review");
}

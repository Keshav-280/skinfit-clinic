import { readStaffReview, STAFF_AREAS } from "@/src/lib/staffReview/model";

/** What the report writer is told about the staff markings: area names and the photos they are on. */
export function clinicMarks(scoresJson: unknown): { clinic_marked_areas?: { area: string; photos: string[] }[] } {
  const review = readStaffReview(scoresJson);
  if (!review) return {};
  return {
    clinic_marked_areas: STAFF_AREAS.flatMap((a) => {
      const photos = [...new Set(review.shapes.filter((s) => s.area === a.key).map((s) => s.view))];
      return photos.length ? [{ area: a.label, photos }] : [];
    }),
  };
}

// TEMPORARY — no-auth preview of the Maintain page hero with the new doctor
// avatar, for local design review only. Uses mock data (no DB needed).
// Safe to delete once confirmed; not linked from anywhere in the app.
import SchedulesPageClient from "@/components/dashboard/SchedulesPageClient";

export default async function SchedulesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ photo?: string }>;
}) {
  // ?photo=0 shows the initials fallback (what real patients will see
  // until a real photo URL is set on the doctor's profile in the
  // database); omit it to see the real Dr. Ruby photo.
  const resolvedSearchParams = await searchParams;
  const usePlaceholderPhoto = resolvedSearchParams.photo !== "0";

  return (
    <div className="min-h-dvh bg-[#F5F3EF] px-4 py-6 md:px-6">
      <SchedulesPageClient
        initialTreatmentEvents={[]}
        initialAppointmentEvents={[]}
        pendingScheduleRequests={[]}
        closedScheduleRequests={[]}
        wellnessWeekYmd="2026-08-17"
        checkinConcern="acne"
        checkinCompleted={false}
        assignedDoctor={{
          name: "Dr. Ruby Sachdev",
          photoUrl: usePlaceholderPhoto ? "/images/dr-ruby.png" : null,
        }}
      />
    </div>
  );
}

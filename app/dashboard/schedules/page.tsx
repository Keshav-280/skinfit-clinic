import { redirect } from "next/navigation";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { loadSchedulePageData } from "@/src/lib/loadSchedulePageData";
import SchedulesPageClient from "@/components/dashboard/SchedulesPageClient";

export default async function SchedulesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const data = await loadSchedulePageData(userId);

  return (
    <div className="min-h-full bg-[#E8EFE6] px-4 py-5 pb-12 md:px-6">
      <SchedulesPageClient
        initialTreatmentEvents={data.initialTreatmentEvents}
        initialAppointmentEvents={data.initialAppointmentEvents}
        pendingScheduleRequests={data.pendingScheduleRequests}
        closedScheduleRequests={data.closedScheduleRequests}
        initialScheduleUnreadCount={data.initialScheduleUnreadCount}
        latestVisit={data.latestVisit}
        assignedDoctor={data.assignedDoctor}
        showKaiInsights={data.showKaiInsights}
        patientHasPhone={data.patientHasPhone}
        initialPhoneCountryCode={data.initialPhoneCountryCode}
        initialPhone={data.initialPhone}
        initialWellnessCheckin={data.initialWellnessCheckin}
        wellnessWeekYmd={data.wellnessWeekYmd}
        checkinConcern={data.checkinConcern}
        checkinSummary={data.checkinSummary}
        checkinCompleted={data.checkinCompleted}
        weeklyCheckinStreak={data.weeklyCheckinStreak}
      />
    </div>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "../../src/lib/auth/get-session";
import { loadSchedulePageData } from "../../src/lib/loadSchedulePageData";
import { PatientDashboardDesktop } from "../../components/dashboard/PatientDashboardDesktop";
import AppointmentsCalendarClient from "../../components/dashboard/AppointmentsCalendarClient";
import { CalendarSkeleton } from "../../components/dashboard/PageSkeletons";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  let schedule: Awaited<ReturnType<typeof loadSchedulePageData>>;
  try {
    schedule = await loadSchedulePageData(userId);
  } catch (e) {
    console.error("[dashboard] loadSchedulePageData failed", e);
    schedule = {
      initialTreatmentEvents: [],
      initialAppointmentEvents: [],
      pendingScheduleRequests: [],
      closedScheduleRequests: [],
      initialScheduleUnreadCount: 0,
      latestVisit: null,
      assignedDoctor: null,
      showKaiInsights: false,
      patientHasPhone: true,
      initialPhoneCountryCode: "+91",
      initialPhone: null,
      initialWellnessCheckin: null,
      wellnessWeekYmd: "",
      checkinConcern: null,
      checkinSummary: null,
      checkinCompleted: false,
      weeklyCheckinStreak: 0,
    } as unknown as Awaited<ReturnType<typeof loadSchedulePageData>>;
  }

  return (
    <PatientDashboardDesktop
      calendarSlot={
        <Suspense
          fallback={
            <CalendarSkeleton />
          }
        >
          <AppointmentsCalendarClient
            initialTreatmentEvents={schedule.initialTreatmentEvents}
            initialAppointmentEvents={schedule.initialAppointmentEvents}
            pendingScheduleRequests={schedule.pendingScheduleRequests}
            closedScheduleRequests={schedule.closedScheduleRequests}
            initialScheduleUnreadCount={schedule.initialScheduleUnreadCount}
            latestVisit={schedule.latestVisit}
            assignedDoctor={schedule.assignedDoctor}
            showKaiInsights={false}
            patientHasPhone={schedule.patientHasPhone}
            initialPhoneCountryCode={schedule.initialPhoneCountryCode}
            initialPhone={schedule.initialPhone}
          />
        </Suspense>
      }
    />
  );
}

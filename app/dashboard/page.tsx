import { redirect } from "next/navigation";
import { getSessionUserId } from "../../src/lib/auth/get-session";
import { loadSchedulePageData } from "../../src/lib/loadSchedulePageData";
import { PatientDashboardDesktop } from "../../components/dashboard/PatientDashboardDesktop";
import AppointmentsCalendarClient from "../../components/dashboard/AppointmentsCalendarClient";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const schedule = await loadSchedulePageData(userId);

  return (
    <PatientDashboardDesktop
      calendarSlot={
        <AppointmentsCalendarClient
          initialTreatmentEvents={schedule.initialTreatmentEvents}
          initialAppointmentEvents={schedule.initialAppointmentEvents}
          pendingScheduleRequests={schedule.pendingScheduleRequests}
          closedScheduleRequests={schedule.closedScheduleRequests}
          initialScheduleUnreadCount={schedule.initialScheduleUnreadCount}
          latestVisit={schedule.latestVisit}
          assignedDoctor={schedule.assignedDoctor}
          showKaiInsights={schedule.showKaiInsights}
          patientHasPhone={schedule.patientHasPhone}
          initialPhoneCountryCode={schedule.initialPhoneCountryCode}
          initialPhone={schedule.initialPhone}
        />
      }
    />
  );
}

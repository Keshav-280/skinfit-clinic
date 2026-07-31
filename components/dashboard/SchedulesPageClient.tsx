"use client";

import {
  WeeklyWellnessCheckinCard,
  type WellnessCheckinData,
} from "@/components/dashboard/WeeklyWellnessCheckinCard";
import type { LastTreatmentVisit } from "@/components/dashboard/LastTreatmentCard";

/** Kept for page.tsx / mobile type compatibility — calendar UI removed from Maintain. */
export type ScheduleEventRow = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  eventSlotEndTimeHm?: string | null;
  title: string;
  eventKind?: string;
  completed: boolean;
  cancelled?: boolean;
  attachmentsCount?: number;
  crmPatientMessage?: string | null;
  cancellationReason?: string | null;
  doctorName?: string | null;
  doctorPhotoUrl?: string | null;
  appointmentType?: string | null;
};

export type PendingScheduleRequestRow = {
  id: string;
  preferredDateYmd: string;
  issue?: string;
  daysAffected?: number | null;
  timePreferences: string;
  attachmentsCount?: number;
  status: string;
  cancelledReason?: string | null;
};

type AssignedDoctorSummary = {
  name: string;
  photoUrl: string | null;
};

/**
 * Maintain tab — weekly wellness questionnaire only.
 * Props from page.tsx are accepted for compatibility; only wellness fields are used.
 */
export default function SchedulesPageClient({
  initialWellnessCheckin = null,
  wellnessWeekYmd,
}: {
  initialTreatmentEvents: ScheduleEventRow[];
  initialAppointmentEvents: ScheduleEventRow[];
  pendingScheduleRequests: PendingScheduleRequestRow[];
  closedScheduleRequests: PendingScheduleRequestRow[];
  initialScheduleUnreadCount?: number;
  latestVisit?: LastTreatmentVisit | null;
  assignedDoctor?: AssignedDoctorSummary | null;
  showKaiInsights?: boolean;
  patientHasPhone?: boolean;
  initialPhoneCountryCode?: string;
  initialPhone?: string | null;
  initialWellnessCheckin?: WellnessCheckinData | null;
  wellnessWeekYmd: string;
}) {
  return (
    <WeeklyWellnessCheckinCard
      initialCheckin={initialWellnessCheckin}
      initialWeekYmd={wellnessWeekYmd}
    />
  );
}

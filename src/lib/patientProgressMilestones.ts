import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs } from "@/src/db/schema";
import { getOnboardingAccessForUser } from "@/src/lib/onboardingAccess";
import { getQuestionnaireCompletionState } from "@/src/lib/questionnaireCompletion";
import { countOutstandingSkippedQuestions } from "@/src/lib/onboardingQuestionnaireDefaults";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";

export type ProgressMilestoneId =
  | "account"
  | "onboarding_scan"
  | "questionnaire"
  | "daily_journal"
  | "clinic_visit";

export type ProgressMilestone = {
  id: ProgressMilestoneId;
  label: string;
  done: boolean;
  href: string | null;
};

export type JournalTrackerId = "sleep" | "hydration" | "stress";

export type PatientProgressSnapshot = {
  milestones: ProgressMilestone[];
  completedCount: number;
  allComplete: boolean;
  questionnaireUnlocks: string[];
  clinicVisitUnlocks: string[];
  /** Trackers still missing for the daily journal milestone, in suggested order. */
  journalPendingTrackers: JournalTrackerId[];
  /** Questionnaire submitted but with skipped questions still unanswered. */
  questionnaireSkippedCount: number;
};

export const QUESTIONNAIRE_UNLOCKED_FEATURES = [
  "Today's focus",
  "Skin DNA",
  "kAI insights",
] as const;

export const CLINIC_VISIT_UNLOCKED_FEATURES = ["Doctor chat"] as const;

const STRESS_MOODS = new Set([
  "Calm",
  "Neutral",
  "Anxious",
  "Stressed",
  "Overwhelmed",
]);

const MILESTONE_HREFS: Record<ProgressMilestoneId, string | null> = {
  account: null,
  onboarding_scan: "/onboarding/capture/photos",
  questionnaire: "/onboarding/questionnaire?entry=resume",
  daily_journal: "/dashboard",
  clinic_visit: "/dashboard/schedules",
};

/** Trackers still missing for the daily journal milestone (sleep, hydration, stress). */
export async function getPendingJournalTrackers(
  userId: string
): Promise<JournalTrackerId[]> {
  const rows = await db
    .select({
      sleepHours: dailyLogs.sleepHours,
      sleepQuality: dailyLogs.sleepQuality,
      waterGlasses: dailyLogs.waterGlasses,
      stressLevel: dailyLogs.stressLevel,
      mood: dailyLogs.mood,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId));

  let hasSleep = false;
  let hasHydration = false;
  let hasStress = false;

  for (const row of rows) {
    if ((row.sleepHours ?? 0) > 0 || row.sleepQuality) {
      hasSleep = true;
    }
    if ((row.waterGlasses ?? 0) > 0) {
      hasHydration = true;
    }
    const mood = row.mood?.trim() ?? "";
    if (
      (row.stressLevel ?? 5) !== 5 ||
      (mood.length > 0 &&
        STRESS_MOODS.has(mood) &&
        mood !== "Neutral")
    ) {
      hasStress = true;
    }
  }

  const pending: JournalTrackerId[] = [];
  if (!hasSleep) pending.push("sleep");
  if (!hasHydration) pending.push("hydration");
  if (!hasStress) pending.push("stress");
  return pending;
}

/** Daily journal = sleep, hydration, and stress trackers each logged at least once. */
export async function hasDailyJournalTrackersComplete(
  userId: string
): Promise<boolean> {
  return (await getPendingJournalTrackers(userId)).length === 0;
}

const JOURNAL_TRACKER_HREFS: Record<JournalTrackerId, string> = {
  sleep: "/dashboard/sleep-tracker",
  hydration: "/dashboard/hydration-tracker",
  stress: "/dashboard/stress-tracker",
};

export async function getPatientProgressSnapshot(
  userId: string
): Promise<PatientProgressSnapshot> {
  const [access, clinicVisited, journalPendingTrackers, questionnaireState] =
    await Promise.all([
      getOnboardingAccessForUser(userId),
      isPatientClinicVisited(userId),
      getPendingJournalTrackers(userId),
      getQuestionnaireCompletionState(userId),
    ]);
  const hasQuestionnaire = questionnaireState.submitted;
  // Survey shows green only when every question is answered; submitted with
  // skips keeps it tappable so the patient can finish the rest.
  const questionnaireDone = questionnaireState.fullyComplete;
  const hasOnboardingScan =
    access.hasBaselineScan || access.baselineScanPending;
  const hasDailyJournal = journalPendingTrackers.length === 0;
  const journalHref = hasDailyJournal
    ? MILESTONE_HREFS.daily_journal
    : JOURNAL_TRACKER_HREFS[journalPendingTrackers[0]!];

  const milestones: ProgressMilestone[] = [
    {
      id: "account",
      label: "Account created",
      done: true,
      href: MILESTONE_HREFS.account,
    },
    {
      id: "questionnaire",
      label: "Questionnaire",
      done: questionnaireDone,
      href: questionnaireDone ? null : MILESTONE_HREFS.questionnaire,
    },
    {
      id: "onboarding_scan",
      label: "Onboarding scan",
      done: hasOnboardingScan,
      href: MILESTONE_HREFS.onboarding_scan,
    },
    {
      id: "daily_journal",
      label: "Complete your first daily journal",
      done: hasDailyJournal,
      href: journalHref,
    },
    {
      id: "clinic_visit",
      label: "Clinic visit",
      done: clinicVisited,
      href: MILESTONE_HREFS.clinic_visit,
    },
  ];

  const completedCount = milestones.filter((m) => m.done).length;
  const allComplete = completedCount === milestones.length;

  return {
    milestones,
    completedCount,
    allComplete,
    questionnaireUnlocks: hasQuestionnaire
      ? []
      : [...QUESTIONNAIRE_UNLOCKED_FEATURES],
    clinicVisitUnlocks: clinicVisited ? [] : [...CLINIC_VISIT_UNLOCKED_FEATURES],
    journalPendingTrackers,
    questionnaireSkippedCount:
      hasQuestionnaire && !questionnaireDone
        ? countOutstandingSkippedQuestions(questionnaireState.skippedSteps)
        : 0,
  };
}

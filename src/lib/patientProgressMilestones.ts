import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs } from "@/src/db/schema";
import { getOnboardingAccessForUser } from "@/src/lib/onboardingAccess";
import { isQuestionnaireMilestoneComplete } from "@/src/lib/questionnaireCompletion";
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

export type PatientProgressSnapshot = {
  milestones: ProgressMilestone[];
  completedCount: number;
  allComplete: boolean;
  questionnaireUnlocks: string[];
  clinicVisitUnlocks: string[];
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
  questionnaire: "/onboarding/questionnaire",
  daily_journal: "/dashboard",
  clinic_visit: "/dashboard/schedules",
};

/** Daily journal = sleep, hydration, and stress trackers each logged at least once. */
export async function hasDailyJournalTrackersComplete(
  userId: string
): Promise<boolean> {
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

  return hasSleep && hasHydration && hasStress;
}

export async function getPatientProgressSnapshot(
  userId: string
): Promise<PatientProgressSnapshot> {
  const [access, clinicVisited, hasDailyJournal, hasQuestionnaire] =
    await Promise.all([
      getOnboardingAccessForUser(userId),
      isPatientClinicVisited(userId),
      hasDailyJournalTrackersComplete(userId),
      isQuestionnaireMilestoneComplete(userId),
    ]);
  const hasOnboardingScan =
    access.hasBaselineScan || access.baselineScanPending;

  const milestones: ProgressMilestone[] = [
    {
      id: "account",
      label: "Account created",
      done: true,
      href: MILESTONE_HREFS.account,
    },
    {
      id: "onboarding_scan",
      label: "Onboarding scan",
      done: hasOnboardingScan,
      href: MILESTONE_HREFS.onboarding_scan,
    },
    {
      id: "questionnaire",
      label: "Questionnaire",
      done: hasQuestionnaire,
      href: MILESTONE_HREFS.questionnaire,
    },
    {
      id: "daily_journal",
      label: "Complete your first daily journal",
      done: hasDailyJournal,
      href: MILESTONE_HREFS.daily_journal,
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
  };
}

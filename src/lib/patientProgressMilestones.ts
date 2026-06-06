import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { dailyLogs } from "@/src/db/schema";
import {
  getOnboardingAccessForUser,
  userHasQuestionnaire,
} from "@/src/lib/onboardingAccess";
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

const MILESTONE_HREFS: Record<ProgressMilestoneId, string | null> = {
  account: null,
  onboarding_scan: "/onboarding/capture",
  questionnaire: "/onboarding/questionnaire",
  daily_journal: "/dashboard/morning-routine",
  clinic_visit: "/dashboard/schedules",
};

export async function getPatientProgressSnapshot(
  userId: string
): Promise<PatientProgressSnapshot> {
  const [access, clinicVisited, journalRow] = await Promise.all([
    getOnboardingAccessForUser(userId),
    isPatientClinicVisited(userId),
    db
      .select({ id: dailyLogs.id })
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          isNotNull(dailyLogs.journalEntry),
          sql`length(trim(${dailyLogs.journalEntry})) > 0`
        )
      )
      .limit(1),
  ]);

  const hasQuestionnaire =
    access.hasQuestionnaire || access.onboardingComplete;
  const hasOnboardingScan =
    access.hasBaselineScan || access.baselineScanPending;
  const hasJournal = journalRow.length > 0;

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
      label: "Daily journal",
      done: hasJournal,
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


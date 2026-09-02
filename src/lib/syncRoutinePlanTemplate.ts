/**
 * Previously copied a default AM/PM template into unlocked patient rows on load/cron.
 * Plans are now clinician-authored only - no automatic default checklist.
 */

/** @deprecated No-op; retained for call-site stability. */
export async function refreshRoutinePlanTemplateForUserIfUnlocked(
  _userId: string,
  _row: {
    onboardingComplete: boolean;
    routinePlanClinicianLocked: boolean;
  }
): Promise<void> {
  return;
}

/** @deprecated No-op; retained for cron/tick response shape. */
export async function syncRoutinePlanTemplateForUnlockedPatients(): Promise<{
  updated: number;
}> {
  return { updated: 0 };
}

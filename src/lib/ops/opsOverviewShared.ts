// Pure types/helpers shared between the server-only data loader
// (loadOpsOverview.ts, which touches the DB) and the client component -
// kept in their own file with no server-only imports so bundling this
// into the client never pulls in `db`/`node:fs`.

export type OpsPatientRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  signedUpAt: string;
  lastLoginAt: string | null;
  loginAtList: string[];
  hasScan: boolean;
  scanCount: number;
  lastScanAt: string | null;
  scanAtList: string[];
  questionnaireDone: boolean;
  questionnaireAt: string | null;
};

export type OpsOverview = {
  totals: {
    signedUp: number;
    loggedIn: number;
    loggedInLast7Days: number;
    tookScan: number;
    filledQuestionnaire: number;
    waitlist: number;
    weeklyCheckins: number;
  };
  patients: OpsPatientRow[];
};

export function latestIso(
  ...values: Array<string | null | undefined>
): string | null {
  let best: string | null = null;
  let max = 0;
  for (const value of values) {
    if (!value) continue;
    const t = Date.parse(value);
    if (Number.isFinite(t) && t > max) {
      max = t;
      best = value;
    }
  }
  return best;
}

/** Last time this patient used the website, including signup, scan, or questionnaire. */
export function inferLastSeenAt(row: OpsPatientRow): string | null {
  return latestIso(
    row.lastLoginAt,
    row.lastScanAt,
    row.questionnaireAt,
    row.signedUpAt,
    ...row.loginAtList,
    ...row.scanAtList
  );
}

/** Came back after creating an account, or used scan / questionnaire / recorded login. */
export function hasReturnedToPortal(row: OpsPatientRow): boolean {
  return Boolean(
    row.hasScan ||
      row.questionnaireDone ||
      row.lastLoginAt ||
      row.loginAtList.length > 0
  );
}

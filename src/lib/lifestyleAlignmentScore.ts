/**
 * Diagnose "Consistency" ring.
 * Expected cadence: one scan and one questionnaire each calendar week
 * they have been using the app. AM/PM routine is not part of this score.
 */
export function mondayYmdOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const dow = new Date(utc).getUTCDay(); // 0 Sun .. 6 Sat
  const daysFromMonday = (dow + 6) % 7;
  const monday = new Date(utc - daysFromMonday * 86_400_000);
  const yy = monday.getUTCFullYear();
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function weekStartUtc(mondayYmd: string): Date {
  return new Date(`${mondayYmd}T00:00:00.000Z`);
}

/** Inclusive calendar week: Monday YMD through today YMD. */
export function isYmdInWeek(
  ymd: string,
  mondayYmd: string,
  todayYmd: string
): boolean {
  return ymd >= mondayYmd && ymd <= todayYmd;
}

/** Monday-start weeks from startYmd through todayYmd, minimum 1. */
export function weeksOnApp(startYmd: string, todayYmd: string): number {
  const startMonday = mondayYmdOf(startYmd);
  const todayMonday = mondayYmdOf(todayYmd);
  const start = Date.parse(`${startMonday}T00:00:00.000Z`);
  const today = Date.parse(`${todayMonday}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(today) || today < start) {
    return 1;
  }
  return Math.floor((today - start) / (7 * 86_400_000)) + 1;
}

export function computeLifestyleAlignmentScore(input: {
  weeksOnApp: number;
  scanCount: number;
  questionnaireCount: number;
}): number {
  const weeks = Math.max(1, Math.round(input.weeksOnApp));
  const scans = Math.max(0, input.scanCount);
  const questionnaires = Math.max(0, input.questionnaireCount);
  const scanRate = Math.min(1, scans / weeks);
  const questionnaireRate = Math.min(1, questionnaires / weeks);
  return Math.min(100, Math.max(0, Math.round(50 * scanRate + 50 * questionnaireRate)));
}

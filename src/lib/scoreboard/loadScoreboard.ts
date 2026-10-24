import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import { ensureSignupSourcesSchema } from "@/src/lib/attribution/signupSource";
import { opsTodayYmd } from "@/src/lib/ops/opsDates";

export type WeekStats = {
  signups: number;
  activated: number;
  scans: number;
  scanners: number;
  returningScanners: number;
  checkins: number;
  requests: number;
  confirmed: number;
};

export type SourceRow = { source: string; signups: number; activated: number };

export type Scoreboard = {
  weekOffset: number;
  rangeLabel: string;
  weekStartYmd: string;
  weekEndYmd: string;
  current: WeekStats;
  previous: WeekStats;
  bySource: SourceRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monday (IST calendar) of the week that contains `ymd`. */
function mondayOf(ymd: string): string {
  const ms = ymdToUtcMs(ymd);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return utcMsToYmd(ms - back * DAY_MS);
}

function istInstant(ymd: string): string {
  return `${ymd}T00:00:00+05:30`;
}

function formatDay(ymd: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(ymdToUtcMs(ymd)));
}

async function statsForRange(startIso: string, endIso: string): Promise<WeekStats> {
  const res = await db.execute<Record<string, string | number>>(sql`
    SELECT
      (SELECT COUNT(*) FROM users u
         WHERE u.role = 'patient'
           AND u.created_at >= ${startIso}::timestamptz AND u.created_at < ${endIso}::timestamptz) AS signups,
      (SELECT COUNT(*) FROM users u
         WHERE u.role = 'patient'
           AND u.created_at >= ${startIso}::timestamptz AND u.created_at < ${endIso}::timestamptz
           AND EXISTS (SELECT 1 FROM scans s WHERE s.user_id = u.id)) AS activated,
      (SELECT COUNT(*) FROM scans s JOIN users u ON u.id = s.user_id
         WHERE u.role = 'patient'
           AND s.created_at >= ${startIso}::timestamptz AND s.created_at < ${endIso}::timestamptz) AS scans,
      (SELECT COUNT(DISTINCT s.user_id) FROM scans s JOIN users u ON u.id = s.user_id
         WHERE u.role = 'patient'
           AND s.created_at >= ${startIso}::timestamptz AND s.created_at < ${endIso}::timestamptz) AS scanners,
      (SELECT COUNT(DISTINCT s.user_id) FROM scans s JOIN users u ON u.id = s.user_id
         WHERE u.role = 'patient'
           AND s.created_at >= ${startIso}::timestamptz AND s.created_at < ${endIso}::timestamptz
           AND EXISTS (SELECT 1 FROM scans p WHERE p.user_id = s.user_id AND p.created_at < ${startIso}::timestamptz)) AS returning_scanners,
      (SELECT COUNT(*) FROM wellness_checkins w
         WHERE w.submitted_at IS NOT NULL
           AND w.submitted_at >= ${startIso}::timestamptz AND w.submitted_at < ${endIso}::timestamptz) AS checkins,
      (SELECT COUNT(*) FROM patient_schedule_requests r
         WHERE r.created_at >= ${startIso}::timestamptz AND r.created_at < ${endIso}::timestamptz) AS requests,
      (SELECT COUNT(*) FROM patient_schedule_requests r
         WHERE r.status = 'confirmed'
           AND r.created_at >= ${startIso}::timestamptz AND r.created_at < ${endIso}::timestamptz) AS confirmed
  `);
  const row = res.rows[0] ?? {};
  const n = (k: string) => Number(row[k] ?? 0);
  return {
    signups: n("signups"),
    activated: n("activated"),
    scans: n("scans"),
    scanners: n("scanners"),
    returningScanners: n("returning_scanners"),
    checkins: n("checkins"),
    requests: n("requests"),
    confirmed: n("confirmed"),
  };
}

async function sourcesForRange(startIso: string, endIso: string): Promise<SourceRow[]> {
  await ensureSignupSourcesSchema();
  const res = await db.execute<{ source: string; signups: string; activated: string }>(sql`
    SELECT COALESCE(ss.source, 'unknown') AS source,
           COUNT(*) AS signups,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM scans s WHERE s.user_id = u.id)) AS activated
    FROM users u
    LEFT JOIN signup_sources ss ON ss.user_id = u.id
    WHERE u.role = 'patient'
      AND u.created_at >= ${startIso}::timestamptz AND u.created_at < ${endIso}::timestamptz
    GROUP BY 1
    ORDER BY COUNT(*) DESC, 1
    LIMIT 12
  `);
  return res.rows.map((r) => ({
    source: r.source,
    signups: Number(r.signups),
    activated: Number(r.activated),
  }));
}

/** weekOffset 0 = this week (Mon to now, IST), -1 = last week, and so on. */
export async function loadScoreboard(weekOffset: number): Promise<Scoreboard> {
  const offset = Math.max(-52, Math.min(0, Math.trunc(weekOffset) || 0));
  const monday = mondayOf(opsTodayYmd());
  const startMs = ymdToUtcMs(monday) + offset * 7 * DAY_MS;
  const startYmd = utcMsToYmd(startMs);
  const nextYmd = utcMsToYmd(startMs + 7 * DAY_MS);
  const prevYmd = utcMsToYmd(startMs - 7 * DAY_MS);
  const endDisplayYmd = utcMsToYmd(startMs + 6 * DAY_MS);

  const [current, previous, bySource] = await Promise.all([
    statsForRange(istInstant(startYmd), istInstant(nextYmd)),
    statsForRange(istInstant(prevYmd), istInstant(startYmd)),
    sourcesForRange(istInstant(startYmd), istInstant(nextYmd)),
  ]);

  return {
    weekOffset: offset,
    rangeLabel: `${formatDay(startYmd)} to ${formatDay(endDisplayYmd)}`,
    weekStartYmd: startYmd,
    weekEndYmd: endDisplayYmd,
    current,
    previous,
    bySource,
  };
}

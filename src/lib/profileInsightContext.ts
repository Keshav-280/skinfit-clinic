import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { differenceInCalendarDays, format, subDays } from "date-fns";
import { db } from "@/src/db";
import {
  chatMessages,
  chatThreads,
  dailyLogs,
  scans,
  skinDnaCards,
  users,
  visitNotes,
  weeklyReports,
} from "@/src/db/schema";
import { dateOnlyFromYmd, ymdFromDateOnly } from "@/src/lib/date-only";
import { localYmdAndHm, normalizeIanaTimeZone } from "@/src/lib/timeZoneWallClock";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";
import {
  kaiScoreFromScanRow,
  ragParamValuesFromScanRow,
} from "@/src/lib/resolveScanDisplayScores";
import {
  correlateBehaviorToDelta,
  summarizeBehavior,
  type BehaviorSnapshot,
} from "@/src/lib/ragCorrelationStats";
import { patientClarityToGrade } from "@/src/lib/clarityGrade";
import { deriveSkinIdentityAt } from "@/src/lib/ragSkinIdentityDerive";

export type ProfileObservationSource =
  | "baseline_scan"
  | "daily_logs"
  | "scan_trend"
  | "weekly_report";

export type ProfileObservationItem = {
  text: string;
  source: ProfileObservationSource;
  dateLabel: string;
};

export type ProfileWindowMode = "baseline_only" | "first_week" | "last_7_days";

export type ProfileScanSummary = {
  id: number;
  dateYmd: string;
  scanName: string | null;
  kaiScore: number | null;
  params: Array<{ key: RagKaiParamKey; value: number | null; delta: number | null }>;
  aiSummary: string | null;
};

export type ProfileInsightContext = {
  userId: string;
  patientName: string;
  mode: ProfileWindowMode;
  modeLabel: string;
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  logDaysUsed: string[];
  scanDaysUsed: string[];
  baselineScanDateYmd: string | null;
  daysSinceBaseline: number;
  identity: {
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
    primaryGoal: string | null;
  };
  baselineScan: ProfileScanSummary | null;
  latestScan: ProfileScanSummary | null;
  scansInWindow: ProfileScanSummary[];
  behavior: BehaviorSnapshot;
  weeklyReportSnippets: Array<{ dateYmd: string; narrative: string; delta: number | null }>;
  visitNotesSummary: string | null;
  recentChatSummary: string | null;
};

function fmtDay(ymd: string): string {
  const d = dateOnlyFromYmd(ymd);
  if (!d) return ymd;
  return format(d, "d MMM");
}

function fmtRange(startYmd: string, endYmd: string): string {
  return `${fmtDay(startYmd)} – ${fmtDay(endYmd)}`;
}

function deltaTrendLabel(delta: number): string {
  if (delta >= 3) return "improved";
  if (delta <= -3) return "worsened";
  return "steady";
}

function scanRowForResolution(scan: {
  scores: unknown;
  overallScore: number | null;
  acne: number | null;
  pigmentation: number | null;
  wrinkles: number | null;
}) {
  return {
    scores: scan.scores,
    overallScore: scan.overallScore ?? 0,
    acne: scan.acne ?? 0,
    wrinkles: scan.wrinkles ?? 0,
    pigmentation: scan.pigmentation ?? 0,
    hydration: 0,
    texture: 0,
  };
}

function scanToSummary(
  scan: {
    id: number;
    createdAt: Date;
    scanName: string | null;
    overallScore: number | null;
    scores: unknown;
    pigmentation: number | null;
    acne: number | null;
    wrinkles: number | null;
    aiSummary: string | null;
  },
  prevVals: Record<string, number | undefined>
): ProfileScanSummary {
  const vals = ragParamValuesFromScanRow(scanRowForResolution(scan));
  const params = RAG_KAI_PARAM_KEYS.map((key) => {
    const v0 = vals[key];
    const v1 = prevVals[key];
    return {
      key,
      value: typeof v0 === "number" ? Math.round(v0) : null,
      delta:
        typeof v0 === "number" && typeof v1 === "number"
          ? Math.round(v0 - v1)
          : null,
    };
  });
  return {
    id: scan.id,
    dateYmd: ymdFromDateOnly(scan.createdAt),
    scanName: scan.scanName,
    kaiScore: kaiScoreFromScanRow(scanRowForResolution(scan)),
    params,
    aiSummary: scan.aiSummary,
  };
}

/** Mean kAI score across every scan in the active profile window (not latest-only). */
export function averageKaiScoreInWindow(
  scans: ProfileScanSummary[]
): number | null {
  const scores = scans
    .map((s) => s.kaiScore)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
}

async function loadVisitNotesSummary(userId: string, before: Date): Promise<string | null> {
  const notes = await db.query.visitNotes.findMany({
    where: eq(visitNotes.userId, userId),
    orderBy: [desc(visitNotes.visitDate)],
    limit: 12,
  });
  const recent = notes.filter((n) => n.visitDate.getTime() <= before.getTime()).slice(0, 4);
  if (!recent.length) return null;
  return recent
    .map(
      (n) =>
        `${ymdFromDateOnly(n.visitDate)} ${n.doctorName}: ${(n.purpose ?? n.notes ?? "").slice(0, 120)}`
    )
    .join("\n");
}

async function loadRecentChatSummary(userId: string, before: Date): Promise<string | null> {
  const thread = await db.query.chatThreads.findFirst({
    where: and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, "ai")),
  });
  if (!thread) return null;
  const msgs = await db
    .select({ sender: chatMessages.sender, text: chatMessages.text, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, thread.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(30);
  const slice = msgs.filter((m) => m.createdAt.getTime() <= before.getTime()).slice(0, 8);
  if (!slice.length) return null;
  return slice
    .map((m) => `${m.sender}: ${m.text.replace(/\s+/g, " ").slice(0, 160)}`)
    .join("\n");
}

export async function gatherProfileInsightContext(
  userId: string
): Promise<ProfileInsightContext> {
  const [userRow, dna, weeklyRows] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        name: true,
        timezone: true,
        skinType: true,
        primaryConcern: true,
        skinSensitivity: true,
        baselineSunExposure: true,
        fitzpatrick: true,
        primaryGoal: true,
      },
    }),
    db.query.skinDnaCards.findFirst({ where: eq(skinDnaCards.userId, userId) }),
    db.query.weeklyReports.findMany({
      where: eq(weeklyReports.userId, userId),
      orderBy: [desc(weeklyReports.createdAt)],
      limit: 3,
    }),
  ]);

  const tz = normalizeIanaTimeZone(userRow?.timezone);
  const todayYmd = localYmdAndHm(new Date(), tz).ymd;
  const todayDate = dateOnlyFromYmd(todayYmd)!;

  const allScans = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      scanName: scans.scanName,
      overallScore: scans.overallScore,
      aiSummary: scans.aiSummary,
      scores: scans.scores,
      acne: scans.acne,
      pigmentation: scans.pigmentation,
      wrinkles: scans.wrinkles,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt));

  const emptyMeta = {
    mode: "baseline_only" as const,
    modeLabel: "No scan data yet",
    windowStartYmd: null as string | null,
    windowEndYmd: todayYmd,
    logDaysUsed: [] as string[],
    scanDaysUsed: [] as string[],
    baselineScanDateYmd: null as string | null,
    daysSinceBaseline: 0,
  };

  if (allScans.length === 0) {
    const logs = await db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, subDays(todayDate, 6)),
          lte(dailyLogs.date, todayDate)
        )
      );
    const windowDays = 7;
    return {
      userId,
      patientName: userRow?.name ?? "Patient",
      ...emptyMeta,
      identity: {
        skinType: dna?.skinType ?? userRow?.skinType ?? null,
        primaryConcern: dna?.primaryConcern ?? userRow?.primaryConcern ?? null,
        sensitivityIndex: dna?.sensitivityIndex ?? null,
        uvSensitivity: dna?.uvSensitivity ?? userRow?.baselineSunExposure ?? null,
        hormonalCorrelation: dna?.hormonalCorrelation ?? null,
        primaryGoal: userRow?.primaryGoal ?? null,
      },
      baselineScan: null,
      latestScan: null,
      scansInWindow: [],
      behavior: summarizeBehavior(logs, windowDays),
      weeklyReportSnippets: [],
      visitNotesSummary: await loadVisitNotesSummary(userId, todayDate),
      recentChatSummary: await loadRecentChatSummary(userId, todayDate),
    };
  }

  const firstScan = allScans[0];
  const baselineYmd = ymdFromDateOnly(firstScan.createdAt);
  const daysSinceBaseline = differenceInCalendarDays(todayDate, firstScan.createdAt);
  const useRolling7 = daysSinceBaseline >= 7;
  const windowStartDate = useRolling7
    ? subDays(todayDate, 6)
    : dateOnlyFromYmd(baselineYmd) ?? firstScan.createdAt;
  const windowEndDate = todayDate;
  const windowStartYmd = ymdFromDateOnly(windowStartDate);
  const windowEndYmd = todayYmd;
  const windowDays = Math.max(1, differenceInCalendarDays(windowEndDate, windowStartDate) + 1);

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, userId),
        gte(dailyLogs.date, windowStartDate),
        lte(dailyLogs.date, windowEndDate)
      )
    )
    .orderBy(asc(dailyLogs.date));

  const logDaysUsed = logs.map((l) => ymdFromDateOnly(l.date));
  const scansInWindowRaw = allScans.filter(
    (s) => s.createdAt >= windowStartDate && s.createdAt <= windowEndDate
  );
  const scanDaysUsed = scansInWindowRaw.map((s) => ymdFromDateOnly(s.createdAt));

  const summaries: ProfileScanSummary[] = [];
  let prevVals: Record<string, number | undefined> = {};
  for (const s of allScans) {
    summaries.push(scanToSummary(s, prevVals));
    const vals = ragParamValuesFromScanRow(scanRowForResolution(s));
    prevVals = Object.fromEntries(
      RAG_KAI_PARAM_KEYS.map((k) => [k, vals[k]])
    ) as Record<string, number | undefined>;
  }

  const baselineScan = summaries[0] ?? null;
  const latestScan = summaries[summaries.length - 1] ?? null;
  const scansInWindow = summaries.filter((s) =>
    scanDaysUsed.includes(s.dateYmd)
  );

  const mode: ProfileWindowMode = useRolling7
    ? "last_7_days"
    : daysSinceBaseline < 1
      ? "baseline_only"
      : "first_week";
  const modeLabel = useRolling7
    ? `7-day window since first scan · ${fmtRange(windowStartYmd, windowEndYmd)}`
    : daysSinceBaseline < 1
      ? `Baseline scan · ${fmtDay(baselineYmd)}`
      : `First 7 days since first scan · ${fmtRange(windowStartYmd, windowEndYmd)}`;

  const identityAt = deriveSkinIdentityAt({
    asOfDate: todayDate,
    baseline: {
      skinType: dna?.skinType ?? userRow?.skinType ?? null,
      primaryConcern: dna?.primaryConcern ?? userRow?.primaryConcern ?? null,
      sensitivityIndex: dna?.sensitivityIndex ?? null,
      uvSensitivity: dna?.uvSensitivity ?? userRow?.baselineSunExposure ?? null,
      hormonalCorrelation: dna?.hormonalCorrelation ?? null,
    },
    scans: allScans.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      overallScore: s.overallScore ?? 0,
      paramValues: ragParamValuesFromScanRow(scanRowForResolution(s)),
    })),
    logs,
  });

  return {
    userId,
    patientName: userRow?.name ?? "Patient",
    mode,
    modeLabel,
    windowStartYmd,
    windowEndYmd,
    logDaysUsed,
    scanDaysUsed,
    baselineScanDateYmd: baselineYmd,
    daysSinceBaseline,
    identity: {
      skinType: identityAt.skinType,
      primaryConcern: identityAt.primaryConcern,
      sensitivityIndex: identityAt.sensitivityIndex,
      uvSensitivity: identityAt.uvSensitivity,
      hormonalCorrelation: identityAt.hormonalCorrelation,
      primaryGoal: userRow?.primaryGoal ?? null,
    },
    baselineScan,
    latestScan,
    scansInWindow,
    behavior: summarizeBehavior(logs, windowDays),
    weeklyReportSnippets: weeklyRows
      .filter((w) => w.narrativeText?.trim())
      .map((w) => ({
        dateYmd: ymdFromDateOnly(w.createdAt),
        narrative: w.narrativeText!.trim().slice(0, 400),
        delta: w.weeklyDelta,
      })),
    visitNotesSummary: await loadVisitNotesSummary(userId, todayDate),
    recentChatSummary: await loadRecentChatSummary(userId, todayDate),
  };
}

export function buildProfileRetrievalQuery(ctx: ProfileInsightContext): string {
  const weak = ctx.latestScan?.params
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  const topDeltas = (ctx.latestScan?.params ?? [])
    .filter((p) => p.delta != null && p.delta !== 0)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 3);

  const bits: string[] = [];
  if (ctx.identity.primaryConcern) bits.push(ctx.identity.primaryConcern);
  if (weak) bits.push(RAG_KAI_PARAM_LABELS[weak.key]);
  bits.push(...topDeltas.map((p) => RAG_KAI_PARAM_LABELS[p.key]));
  if (ctx.behavior.highSunDays >= 2) bits.push("photoprotection sunscreen UV");
  if (ctx.behavior.highStressDays >= 2) bits.push("stress cortisol barrier");
  if (ctx.behavior.avgSleepHours < 6) bits.push("sleep recovery");
  bits.push("profile summary", "priority actions", "Indian skin", "dermatology");
  return bits.join(" ");
}

export function profileContextForLlm(
  ctx: ProfileInsightContext,
  scoresUnlocked = false
): string {
  const paramsLine = (s: ProfileScanSummary | null) => {
    if (!s) return "none";
    if (scoresUnlocked) {
      return `kAI ${s.kaiScore ?? "—"}/100 · ${s.params
        .map((p) => {
          const d =
            p.delta == null
              ? ""
              : p.delta >= 0
                ? ` Δ+${p.delta} (${deltaTrendLabel(p.delta)})`
                : ` Δ${p.delta} (${deltaTrendLabel(p.delta)})`;
          return `${RAG_KAI_PARAM_LABELS[p.key]}=${p.value ?? "—"}${d}`;
        })
        .join(" · ")}`;
    }
    const kai =
      s.kaiScore != null
        ? `kAI grade ${patientClarityToGrade(s.kaiScore)}`
        : "kAI —";
    const params = s.params
      .map((p) => {
        const grade =
          p.value == null ? "—" : patientClarityToGrade(p.value);
        const trend =
          p.delta == null
            ? ""
            : p.delta >= 3
              ? " (improving vs last scan)"
              : p.delta <= -3
                ? " (slipped vs last scan)"
                : " (steady vs last scan)";
        return `${RAG_KAI_PARAM_LABELS[p.key]} grade ${grade}${trend}`;
      })
      .join(" · ");
    return `${kai} · ${params}`;
  };

  return `SCORE_SCALE: All parameters are 0–100 clarity scores — HIGHER is healthier/better, LOWER is worse. Positive Δ = improvement, negative Δ = worsening. Letter grades: A (best) → E (worst).
WINDOW: ${ctx.modeLabel}
Data policy: ${ctx.mode === "last_7_days" ? "Use only last 7 calendar days of logs and scans." : ctx.mode === "first_week" ? "Use all days from baseline scan through today (first week)." : "Baseline scan only; no week trend yet."}
Log days in window (${ctx.logDaysUsed.length}): ${ctx.logDaysUsed.join(", ") || "none"}
Scan days in window (${ctx.scanDaysUsed.length}): ${ctx.scanDaysUsed.join(", ") || "none"}
Baseline scan (${ctx.baselineScanDateYmd ?? "—"}): ${paramsLine(ctx.baselineScan)}
Latest scan: ${paramsLine(ctx.latestScan)}

PATIENT
Name: ${ctx.patientName}
Skin: ${ctx.identity.skinType ?? "unknown"} · Concern: ${ctx.identity.primaryConcern ?? "unknown"} · Sensitivity: ${ctx.identity.sensitivityIndex ?? "—"}/10
UV: ${ctx.identity.uvSensitivity ?? "—"} · Hormonal: ${ctx.identity.hormonalCorrelation ?? "—"} · Goal: ${ctx.identity.primaryGoal ?? "—"}

BEHAVIOR (${ctx.behavior.windowDays}d window, ${ctx.behavior.logCount} log rows)
Sleep avg ${ctx.behavior.avgSleepHours}h · Water ${ctx.behavior.avgWaterGlasses} glasses · Stress ${ctx.behavior.avgStress}/10
Full AM+PM routine days ${ctx.behavior.fullRoutineDays}/${ctx.behavior.windowDays} · High UV days ${ctx.behavior.highSunDays} · High stress days ${ctx.behavior.highStressDays}

${ctx.weeklyReportSnippets.length ? `RECENT WEEKLY REPORTS\n${ctx.weeklyReportSnippets.map((w) => `${w.dateYmd} (Δ${w.delta ?? "—"}): ${w.narrative}`).join("\n")}\n` : ""}${ctx.visitNotesSummary ? `VISIT NOTES\n${ctx.visitNotesSummary}\n` : ""}${ctx.recentChatSummary ? `RECENT AI CHAT\n${ctx.recentChatSummary}\n` : ""}`;
}

export function profileCorrelations(ctx: ProfileInsightContext) {
  const latest = ctx.latestScan;
  if (!latest) return [];
  return latest.params.map((p) =>
    correlateBehaviorToDelta(p.key, p.delta, ctx.behavior)
  );
}

import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import { dailyFocus, dailyLogs, scans, skinScans, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { dateOnlyFromYmd, parseYmdToDateOnly, ymdFromDateOnly } from "@/src/lib/date-only";
import { getPatientDoctorSection } from "@/src/lib/patientDoctorSection";
import {
  buildCompletedRoutineDateSet,
  computeStreakStats,
  createRoutinePlanResolver,
  isFullRoutineDayLog,
} from "@/src/lib/userStreak";
import {
  loadRoutinePlanRevisions,
  resolveRoutinePlanForYmd,
} from "@/src/lib/routinePlanRevisions";
import { localYmdAndHm, normalizeIanaTimeZone } from "@/src/lib/timeZoneWallClock";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";
import { isLlmEnabled } from "@/src/lib/ragLlmAnalysis";
import { userHasQuestionnaire } from "@/src/lib/onboardingAccess";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import { cacheAside, CacheKeys } from "@/src/lib/infra";
import { coerceRoutinePlanList } from "@/src/lib/routine";

function clampPct(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const exists = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const cacheDateKey =
    dateParam && parseYmdToDateOnly(dateParam)
      ? dateParam.slice(0, 10)
      : "rolling";

  const payload = await cacheAside(
    CacheKeys.home(userId, cacheDateKey),
    120,
    async () => buildPatientHomePayload(userId, dateParam)
  );
  return NextResponse.json(payload);
}

async function buildPatientHomePayload(
  userId: string,
  dateParam: string | null
) {
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      name: true,
      skinType: true,
      primaryConcern: true,
      streakCurrent: true,
      streakLongest: true,
      cycleTrackingEnabled: true,
      onboardingComplete: true,
      timezone: true,
      routinePlanAmItems: true,
      routinePlanPmItems: true,
      routinePlanClinicianLocked: true,
      routineAmReminderHm: true,
      routinePmReminderHm: true,
    },
  });
  if (!userRow) {
    throw new Error("NOT_FOUND");
  }

  const routinePlanAmItems = userRow.routinePlanAmItems;
  const routinePlanPmItems = userRow.routinePlanPmItems;

  const tz = normalizeIanaTimeZone(userRow.timezone);
  const localTodayYmd = localYmdAndHm(new Date(), tz).ymd;
  const todayYmdFromProfile =
    dateParam && parseYmdToDateOnly(dateParam)
      ? dateParam.slice(0, 10)
      : localTodayYmd;
  const todayDateOnly = dateOnlyFromYmd(todayYmdFromProfile);
  const isSelectedToday = todayYmdFromProfile === localTodayYmd;
  const weekCut = subDays(todayDateOnly, 7);

  const routineRevisions = await loadRoutinePlanRevisions(db, userId);
  const fallbackPlan = {
    amItems: coerceRoutinePlanList(routinePlanAmItems),
    pmItems: coerceRoutinePlanList(routinePlanPmItems),
  };
  const resolveRoutinePlan = createRoutinePlanResolver(
    routineRevisions,
    fallbackPlan
  );

  function isFullRoutineDay(log: {
    routineAmSteps: boolean[] | null;
    routinePmSteps: boolean[] | null;
    date: Date | string;
  }): boolean {
    return isFullRoutineDayLog(log, resolveRoutinePlan);
  }

  const streakCut = subDays(todayDateOnly, 120);
  const todayPlan = resolveRoutinePlanForYmd(
    routineRevisions,
    fallbackPlan,
    todayYmdFromProfile
  );

  const [
    skinScanRows,
    todayLog,
    lastScans,
    recentLogs,
    streakLogs,
    doctorSection,
    todayFocusRow,
  ] = await Promise.all([
    db.query.skinScans.findMany({
      where: eq(skinScans.userId, userId),
      orderBy: [desc(skinScans.createdAt)],
      limit: 30,
      columns: {
        id: true,
        skinScore: true,
        createdAt: true,
        analysisResults: true,
      },
    }),
    db.query.dailyLogs.findFirst({
      where: and(
        eq(dailyLogs.userId, userId),
        eq(dailyLogs.date, todayDateOnly)
      ),
    }),
    db
      .select({
        overallScore: scans.overallScore,
        createdAt: scans.createdAt,
      })
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.createdAt))
      .limit(2),
    db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, weekCut),
          lte(dailyLogs.date, todayDateOnly)
        )
      ),
    db
      .select({
        date: dailyLogs.date,
        routineAmSteps: dailyLogs.routineAmSteps,
        routinePmSteps: dailyLogs.routinePmSteps,
      })
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, streakCut),
          lte(dailyLogs.date, todayDateOnly)
        )
      ),
    getPatientDoctorSection(userId),
    db.query.dailyFocus.findFirst({
      where: and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.focusDate, todayDateOnly)
      ),
      columns: { message: true, sourceParam: true },
    }),
  ]);

  const skinScanHistory = skinScanRows.map((r) => ({
    id: r.id,
    skinScore: r.skinScore,
    createdAt: r.createdAt.toISOString(),
    analysisResults: r.analysisResults,
  }));

  const todayLogOut = todayLog
    ? {
        journalEntry: todayLog.journalEntry,
        sleepHours: todayLog.sleepHours,
        stressLevel: todayLog.stressLevel,
        waterGlasses: todayLog.waterGlasses,
        mood: todayLog.mood,
        amRoutine: todayLog.amRoutine,
        pmRoutine: todayLog.pmRoutine,
        routineAmSteps: todayLog.routineAmSteps ?? null,
        routinePmSteps: todayLog.routinePmSteps ?? null,
        dietType: todayLog.dietType ?? null,
        sunExposure: todayLog.sunExposure ?? null,
        cycleDay: todayLog.cycleDay ?? null,
        comments: todayLog.comments ?? null,
      }
    : null;

  const kaiSkinScore =
    lastScans[0]?.overallScore ?? skinScanRows[0]?.skinScore ?? 0;

  let weeklyDeltaScore = 0;
  if (lastScans.length >= 2) {
    weeklyDeltaScore =
      lastScans[0].overallScore - lastScans[1].overallScore;
  }

  let amPmDays = 0;
  let sleepSum = 0;
  let waterSum = 0;
  let highSun = 0;
  const completedDatesSet = new Set<string>();
  for (const l of recentLogs) {
    if (isFullRoutineDay(l)) {
      amPmDays += 1;
      completedDatesSet.add(ymdFromDateOnly(l.date instanceof Date ? l.date : String(l.date)));
    }
    sleepSum += l.sleepHours ?? 0;
    waterSum += l.waterGlasses ?? 0;
    if (l.sunExposure === "high" || l.sunExposure === "moderate") {
      highSun += 1;
    }
  }
  const weekCompletedDates = Array.from(completedDatesSet).sort();
  const streakCompleted = buildCompletedRoutineDateSet(
    streakLogs,
    resolveRoutinePlan
  );
  const streakStats = computeStreakStats(streakCompleted, todayYmdFromProfile);
  const streakCurrent = streakStats.current;
  const streakLongest = Math.max(
    userRow.streakLongest ?? 0,
    streakStats.longest
  );
  const n = Math.max(1, recentLogs.length);
  const routineCompletion7d = amPmDays / 7;
  const avgSleep = sleepSum / n;
  const avgWater = waterSum / n;
  const lifestyleAlignmentScore = clampPct(
    routineCompletion7d * 42 +
      Math.min(28, (avgSleep / 8) * 28) +
      Math.min(30, (avgWater / 8) * 30) -
      (highSun >= 4 ? 14 : highSun >= 2 ? 6 : 0)
  );

  const onboardingComplete = userRow.onboardingComplete;
  const hasQuestionnaire = userHasQuestionnaire(userRow.primaryConcern);

  const {
    doctorFeedback,
    doctorVoiceNotes,
    doctorArchivedVoiceNotes,
    doctorVoiceNoteIsNew,
    feedbackEntries,
    archivedFeedbackEntries,
  } = doctorSection;

  const amItems = todayPlan.amItems;
  const pmItems = todayPlan.pmItems;
  const routinePlanReady = Boolean(
    onboardingComplete && amItems.length > 0 && pmItems.length > 0
  );

  return {
    skinScanHistory,
    todayLog: todayLogOut,
    amItems,
    pmItems,
    routinePlanReady,
    kaiSkinScore: clampPct(kaiSkinScore),
    weeklyDeltaScore: Math.round(weeklyDeltaScore),
    lifestyleAlignmentScore,
    /** @deprecated use lifestyleAlignmentScore */
    routineScore: lifestyleAlignmentScore,
    /** @deprecated use weeklyDeltaScore */
    weeklyChangePercent: Math.round(weeklyDeltaScore),
    doctorFeedback,
    doctorVoiceNotes,
    doctorArchivedVoiceNotes,
    /** @deprecated first active note only — use doctorVoiceNotes */
    doctorVoiceNote: doctorVoiceNotes[0] ?? null,
    doctorVoiceNoteIsNew,
    /** Calendar date used for today’s log (patient profile timezone when `date` query omitted). */
    homeDateYmd: todayYmdFromProfile,
    streakCurrent,
    streakLongest,
    weekCompletedDates,
    cycleTrackingEnabled: userRow.cycleTrackingEnabled ?? false,
    onboardingComplete,
    hasQuestionnaire,
    routineAmReminderHm: userRow.routineAmReminderHm ?? "08:30",
    routinePmReminderHm: userRow.routinePmReminderHm ?? "22:00",
    todayFocus:
      isKaiInsightsEnabled() && hasQuestionnaire
        ? todayFocusRow
          ? await resolveTodayFocus()
          : isSelectedToday
            ? await resolveTodayFocus()
            : null
        : null,
    kaiInsightsEnabled: isKaiInsightsEnabled(),
    feedbackEntries,
    archivedFeedbackEntries,
  };

  async function resolveTodayFocus(): Promise<{ message: string; sourceParam: string | null } | null> {
    if (todayFocusRow) {
      return { message: todayFocusRow.message, sourceParam: todayFocusRow.sourceParam ?? null };
    }
    if (!isSelectedToday) return null;
    if (!isKaiInsightsEnabled() || !isLlmEnabled()) return null;
    try {
      const OpenAI = (await import("openai")).default;
      const key = process.env.OPENAI_API_KEY?.trim();
      if (!key) return null;
      const client = new OpenAI({ apiKey: key });
      const mdl = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";

      const logCount = recentLogs.length;
      const avgSleep = logCount > 0
        ? (recentLogs.reduce((s, l) => s + (l.sleepHours ?? 0), 0) / logCount).toFixed(1)
        : "—";
      const avgWater = logCount > 0
        ? (recentLogs.reduce((s, l) => s + (l.waterGlasses ?? 0), 0) / logCount).toFixed(1)
        : "—";
      const avgStress = logCount > 0
        ? (recentLogs.reduce((s, l) => s + (l.stressLevel ?? 5), 0) / logCount).toFixed(1)
        : "—";
      const routineDays = recentLogs.filter((l) => isFullRoutineDay(l)).length;

      let weakestParam = "unknown";
      if (skinScanRows.length > 0) {
        const params = analysisResultsToParams(skinScanRows[0].analysisResults);
        const sorted = [...params].sort((a, b) => a.value - b.value);
        if (sorted.length > 0) weakestParam = sorted[0].label;
      }

      const prompt = `You are kAI, a dermatology AI counselor for a skin-health app.
Generate ONE personalized daily focus tip for today. Be specific, warm, actionable.
First sentence: observation based on data. Second sentence: concrete advice.
Return ONLY JSON: {"message": "...", "sourceParam": "..." or null}

PATIENT: ${userRow?.name ?? "Patient"}
Skin type: ${userRow?.skinType ?? "unknown"}
Primary concern: ${userRow?.primaryConcern ?? "unknown"}
kAI Score: ${kaiSkinScore}
Weakest parameter: ${weakestParam}
Last 7 days: ${routineDays}/${logCount} full routine days, avg sleep ${avgSleep}h, avg water ${avgWater} glasses, avg stress ${avgStress}/10
Today: ${todayYmdFromProfile}`;

      const completion = await client.chat.completions.create({
        model: mdl,
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return ONLY valid JSON. No preamble." },
          { role: "user", content: prompt },
        ],
      });
      const txt = completion.choices[0]?.message?.content;
      if (!txt) return null;
      const parsed = JSON.parse(txt) as { message?: string; sourceParam?: string | null };
      if (!parsed.message) return null;

      const insertVal: typeof dailyFocus.$inferInsert = {
        userId: userId!,
        focusDate: todayDateOnly,
        message: parsed.message,
        sourceParam: parsed.sourceParam ?? undefined,
      };
      await db.insert(dailyFocus).values(insertVal).onConflictDoNothing();

      return { message: parsed.message, sourceParam: parsed.sourceParam ?? null };
    } catch {
      return null;
    }
  }
}

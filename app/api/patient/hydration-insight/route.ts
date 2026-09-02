import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { format, isValid, parseISO, subDays } from "date-fns";
import OpenAI from "openai";
import { db } from "@/src/db";
import { dailyLogs, hydrationInsights, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { cacheAside, CacheKeys } from "@/src/lib/infra";

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

type HydrationInsightResponse = {
  insight: string;
  tip: string;
};

const HYDRATION_INSIGHT_TTL_SECONDS = 60 * 60 * 6;

async function buildHydrationInsightForUser(
  userId: string
): Promise<HydrationInsightResponse> {
  const cutoff = subDays(new Date(), 14);

  const [userRow, recentLogs] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, skinType: true, primaryConcern: true },
    }),
    db
      .select({
        date: dailyLogs.date,
        waterGlasses: dailyLogs.waterGlasses,
        sleepHours: dailyLogs.sleepHours,
        stressLevel: dailyLogs.stressLevel,
        sunExposure: dailyLogs.sunExposure,
      })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, cutoff)))
      .orderBy(desc(dailyLogs.date))
      .limit(14),
  ]);

  const waterRecords = recentLogs
    .filter((l) => l.waterGlasses != null)
    .map((l) => ({
      date: l.date?.toISOString?.() ?? String(l.date),
      glasses: l.waterGlasses ?? 0,
      ml: (l.waterGlasses ?? 0) * 250,
      sleep: l.sleepHours ?? null,
      stress: l.stressLevel ?? null,
      sun: l.sunExposure ?? null,
    }));

  if (waterRecords.length === 0) {
    return {
      insight:
        "Start logging your water intake daily to get personalized hydration insights!",
      tip: "Aim for at least 8 glasses (2L) of water per day for healthy, glowing skin.",
    };
  }

  const client = getClient();
  if (!client) {
    const avgGlasses = Math.round(
      waterRecords.reduce((s, r) => s + r.glasses, 0) / waterRecords.length
    );
    const avgMl = avgGlasses * 250;
    return {
      insight:
        avgMl >= 2000
          ? "Good job! You're on track. Keep maintaining your hydration levels for healthy, glowing skin."
          : `Your average intake is ${avgMl} ml/day. Try to reach at least 2000 ml daily for optimal skin health.`,
      tip:
        avgMl >= 2000
          ? "Consistent hydration helps maintain skin elasticity and reduces signs of aging."
          : "Carry a water bottle with you and set reminders to drink throughout the day.",
    };
  }

  const logSummary = waterRecords
    .map(
      (r) =>
        `${r.date}: ${r.ml}ml (${r.glasses} glasses), sleep=${r.sleep ?? "-"}h, stress=${r.stress ?? "-"}, sun=${r.sun ?? "-"}`
    )
    .join("\n");

  const prompt = `You are a dermatology-focused wellness AI for a skin clinic app.

Patient: ${userRow?.name ?? "Patient"}, skin type: ${userRow?.skinType ?? "unknown"}, concern: ${userRow?.primaryConcern ?? "general"}

Here are the patient's recent hydration + lifestyle logs (last 14 days):
${logSummary}

Based on the hydration data patterns, lifestyle context (sleep, stress, sun exposure), and their skin type:
1. Give a short, encouraging insight about their hydration habits (1-2 sentences). Be specific about their patterns.
2. Give one actionable tip to improve skin health through hydration (1 sentence).

Respond in JSON: {"insight": "...", "tip": "..."}`;

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { insight?: string; tip?: string };

    return {
      insight:
        parsed.insight ?? "Keep tracking your hydration for personalized insights!",
      tip: parsed.tip ?? "Aim for 8 glasses of water daily.",
    };
  } catch {
    const avgGlasses = Math.round(
      waterRecords.reduce((s, r) => s + r.glasses, 0) / waterRecords.length
    );
    return {
      insight:
        avgGlasses >= 8
          ? "Great hydration habits! You're consistently hitting your daily goal."
          : `You're averaging ${avgGlasses} glasses/day. Try to increase to 8+ for better skin health.`,
      tip: "Drinking water first thing in the morning boosts skin hydration after overnight dehydration.",
    };
  }
}

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawDate = url.searchParams.get("date");
  const requestedYmd =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : format(new Date(), "yyyy-MM-dd");
  const insightDate = parseISO(`${requestedYmd}T00:00:00`);
  if (!isValid(insightDate)) {
    return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });
  }

  const existing = await db.query.hydrationInsights.findFirst({
    where: and(
      eq(hydrationInsights.userId, userId),
      eq(hydrationInsights.insightDate, insightDate)
    ),
    columns: { insight: true, tip: true },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const payload = await cacheAside<HydrationInsightResponse>(
    CacheKeys.hydrationInsight(userId, requestedYmd),
    HYDRATION_INSIGHT_TTL_SECONDS,
    () => buildHydrationInsightForUser(userId)
  );

  const now = new Date();
  await db
    .insert(hydrationInsights)
    .values({
      userId,
      insightDate,
      insight: payload.insight,
      tip: payload.tip,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [hydrationInsights.userId, hydrationInsights.insightDate],
      set: {
        insight: payload.insight,
        tip: payload.tip,
        generatedAt: now,
        updatedAt: now,
      },
    });

  return NextResponse.json(payload);
}

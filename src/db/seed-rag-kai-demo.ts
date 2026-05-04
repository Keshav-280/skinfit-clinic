import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "./client";
import { CLINIC_DOCTOR_EMAIL } from "@/src/lib/clinicDoctor";
import { DEMO_LOGIN_EMAIL } from "@/src/lib/auth/demo-login";
import {
  appointments,
  chatMessages,
  chatThreads,
  dailyFocus,
  dailyLogs,
  monthlyReports,
  parameterScores,
  questionnaireAnswers,
  scans,
  skinDnaCards,
  users,
  visitNotes,
  weeklyReports,
} from "@/src/db/schema";
import { RAG_KAI_PARAM_KEYS, type RagKaiParamKey } from "@/src/lib/ragEightParams";

/** 5 steps each side — matches seeded checklist granularity. */
const STEP_N = 5;

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Deterministic-ish sparse journal (~22–26% overall; higher in slump weeks when pattern hits). */
function shouldJournal(daysAgo: number, bad: boolean): boolean {
  const h = (((daysAgo * 31) ^ ((daysAgo >> 3) + 91)) >>> 0) % 113;
  if (bad && h % 13 < 6) return h % 2 === 0;
  return h % 19 < 4;
}

/** Partial AM / PM completions with lazy stretches (realistic uneven effort). */
function routineStepsPattern(
  daysAgo: number,
  bad: boolean
): { amSteps: boolean[]; pmSteps: boolean[] } {
  const bucket = ((daysAgo * 11 + (bad ? 53 : 0)) >>> 0) % 12;
  if (bucket === 0) {
    return {
      amSteps: Array<boolean>(STEP_N).fill(true),
      pmSteps: Array<boolean>(STEP_N).fill(true),
    };
  }
  if (bad) {
    if (bucket % 5 === 0) {
      return {
        amSteps: [true, false, false, false, false],
        pmSteps: [false, false, false, false, false],
      };
    }
    if (bucket % 5 === 1) {
      return {
        amSteps: [true, true, false, false, false],
        pmSteps: [true, false, false, false, false],
      };
    }
    if (bucket % 5 === 2) {
      return {
        amSteps: [true, true, true, false, false],
        pmSteps: [true, false, false, false, false],
      };
    }
    if (bucket % 5 === 3) {
      return {
        amSteps: [true, false, true, false, false],
        pmSteps: [false, false, false, false, false],
      };
    }
    return {
      amSteps: [true, true, false, false, true],
      pmSteps: [true, false, false, true, false],
    };
  }
  if (bucket % 5 === 0) {
    return {
      amSteps: [true, true, true, true, false],
      pmSteps: [true, true, true, true, false],
    };
  }
  if (bucket % 5 === 1) {
    return {
      amSteps: [true, true, true, false, false],
      pmSteps: [true, true, false, false, false],
    };
  }
  return {
    amSteps: [true, true, true, true, true],
    pmSteps: [true, true, true, false, false],
  };
}

export async function seedRagKaiDemoData() {
  const patientHash = await bcrypt.hash("SkinFitDemo2024!", 10);
  await db
    .insert(users)
    .values({
      name: "RAG Demo Patient",
      email: DEMO_LOGIN_EMAIL,
      passwordHash: patientHash,
      role: "patient",
      age: 29,
      skinType: "Combination",
      primaryGoal: "Pigmentation and acne control",
      primaryConcern: "pigmentation",
      skinSensitivity: "moderate",
      fitzpatrick: "IV",
      baselineSleep: "6h",
      baselineSunExposure: "moderate",
      baselineHydration: "5",
      phoneCountryCode: "+91",
      phone: "9000000001",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: "RAG Demo Patient",
        role: "patient",
        age: 29,
        skinType: "Combination",
        primaryGoal: "Pigmentation and acne control",
        primaryConcern: "pigmentation",
      },
    });

  const [patient] = await db.select().from(users).where(eq(users.email, DEMO_LOGIN_EMAIL));
  const [doctor] = await db.select().from(users).where(eq(users.email, CLINIC_DOCTOR_EMAIL));
  if (!patient || !doctor) throw new Error("Required demo users missing");

  const oldScans = await db
    .select({ id: scans.id })
    .from(scans)
    .where(eq(scans.userId, patient.id));
  const oldScanIds = oldScans.map((s) => s.id);
  if (oldScanIds.length > 0) {
    await db.delete(parameterScores).where(inArray(parameterScores.scanId, oldScanIds));
    await db.delete(scans).where(eq(scans.userId, patient.id));
  }
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, patient.id));
  await db.delete(questionnaireAnswers).where(eq(questionnaireAnswers.userId, patient.id));
  await db.delete(dailyFocus).where(eq(dailyFocus.userId, patient.id));
  await db.delete(weeklyReports).where(eq(weeklyReports.userId, patient.id));
  await db.delete(monthlyReports).where(eq(monthlyReports.userId, patient.id));
  await db.delete(visitNotes).where(eq(visitNotes.userId, patient.id));
  await db.delete(skinDnaCards).where(eq(skinDnaCards.userId, patient.id));

  await db.insert(skinDnaCards).values({
    userId: patient.id,
    skinType: "Combination",
    primaryConcern: "Pigmentation",
    sensitivityIndex: 6,
    uvSensitivity: "High",
    hormonalCorrelation: "Detected",
    revision: 1,
  });

  await db.insert(questionnaireAnswers).values([
    { userId: patient.id, questionId: "primary-concern", answer: "pigmentation" },
    { userId: patient.id, questionId: "trigger-list", answer: ["sun", "stress"] },
    { userId: patient.id, questionId: "sleep-baseline", answer: "6h" },
  ]);

  const now = new Date();
  /** Scan every ~3d → typically 23–26 scans inside 75-day window (>10/month over two billing months). */
  const scanDaysAgoDescending: number[] = [];
  for (let d = 73; d >= 0; d -= 3) {
    scanDaysAgoDescending.push(d);
  }
  if (scanDaysAgoDescending[scanDaysAgoDescending.length - 1] !== 0) {
    scanDaysAgoDescending.push(0);
  }

  const totalScans = scanDaysAgoDescending.length;

  const slumpPenalty: Record<number, Partial<Record<RagKaiParamKey, number>>> = {
    5: { pigmentation: -13, active_acne: -12, skin_quality: -10, wrinkles: -5 },
    6: { active_acne: -10, skin_quality: -7 },
    14: { pigmentation: -11, wrinkles: -6 },
    15: { active_acne: -11, sagging_volume: -5 },
    16: { active_acne: -8 },
    22: { pigmentation: -9, acne_scar: -6 },
  };

  let scanOrdinal = -1;

  function demoKaiCentre(i: number, total: number): number {
    const p = total > 1 ? i / (total - 1) : 1;
    let v = Math.round(44 + p * 30);
    v += Math.round(Math.sin(i * 0.92) * 6);
    v += (((i + 13) ** 3) % 11) - 5;
    if (i >= 4 && i <= 8) v -= i % 3 === 0 ? 13 : 6;
    if (i >= 12 && i <= 16) v -= 12;
    if (i >= 19 && i <= 21) v -= 10;
    if (i >= total - 3) v += Math.min(11, Math.round(Math.sin(i) * 4) + 4);
    return clamp(v);
  }

  const scanIds: number[] = [];
  for (const daysAgo of scanDaysAgoDescending) {
    scanOrdinal += 1;
    const createdAt = subDays(now, daysAgo);
    const idx = scanOrdinal;
    const center = demoKaiCentre(idx, totalScans);
    const noise = (((idx ^ daysAgo) % 11) >>> 0) % 7;
    const slump = slumpPenalty[idx] ?? {};

    const byParam: Record<string, number> = {
      active_acne: clamp(center - 8 + noise - 3 + (slump.active_acne ?? 0)),
      sagging_volume: clamp(center - 5 + noise + (slump.sagging_volume ?? 0)),
      hair_health: clamp(center - 6 + noise + (slump.hair_health ?? 0)),
      wrinkles: clamp(center - 11 + noise + (slump.wrinkles ?? 0)),
      skin_quality: clamp(center - 3 + noise + (slump.skin_quality ?? 0)),
      acne_scar: clamp(center - 13 + noise + (slump.acne_scar ?? 0)),
      under_eye: clamp(center - 8 + noise + (slump.under_eye ?? 0)),
      pigmentation: clamp(center - 4 + noise + (slump.pigmentation ?? 0)),
    };
    const overall = clamp(
      RAG_KAI_PARAM_KEYS.reduce((s, k) => s + byParam[k], 0) / RAG_KAI_PARAM_KEYS.length
    );
    const [scan] = await db
      .insert(scans)
      .values({
        userId: patient.id,
        imageUrl: "https://example.com/rag-kai-demo.jpg",
        overallScore: overall,
        acne: byParam.active_acne,
        pigmentation: byParam.pigmentation,
        wrinkles: byParam.wrinkles,
        hydration: byParam.skin_quality,
        texture: byParam.acne_scar,
        aiSummary: "Synthetic demo scan for kAI RAG testing",
        createdAt,
      })
      .returning({ id: scans.id });
    if (!scan) continue;
    scanIds.push(scan.id);
    await db.insert(parameterScores).values(
      RAG_KAI_PARAM_KEYS.map((k) => ({
        scanId: scan.id,
        paramKey: k,
        value: byParam[k],
        source: "ai" as const,
        severityFlag: byParam[k] < 45,
        extras: { demo: true, model: "8-param" },
      }))
    );
  }

  /** 75-day span so two calendar months × ~≥10 scans/month + realistic sluggish logs */
  const daySpanHi = 74;
  for (let d = daySpanHi; d >= 0; d -= 1) {
    const date = subDays(now, d);
    /** Bad stretches loosely aligned with mid-month stress + slump clusters */
    const inBadStretch = (d >= 16 && d <= 28) || (d >= 44 && d <= 56);

    const { amSteps, pmSteps } = routineStepsPattern(d, inBadStretch);
    const amDone = amSteps.length > 0 && amSteps.every(Boolean);
    const pmDone = pmSteps.length > 0 && pmSteps.every(Boolean);

    const stressLevel = inBadStretch ? 6 + (d % 5) : 2 + (d % 5);
    const sleepHours = inBadStretch ? 4 + ((d >>> 2) % 3) : 6 + ((d >>> 3) % 4);
    const waterGlasses = inBadStretch ? 2 + ((d >>> 4) % 3) : 5 + ((d >>> 5) % 4);
    const sunExposure =
      inBadStretch && d % 2 === 0 ? "high" : d % 5 === 0 ? "high" : "moderate";

    let journalEntry: string | null = null;
    if (shouldJournal(d, inBadStretch)) {
      journalEntry =
        inBadStretch
          ? [
              "New papules jawline — skipped cleanser two nights.",
              "Hated texture in mirror; wiped halfway through checklist.",
              "Slept 4–5h, stress high, forehead felt congested.",
            ][d % 3]
          : ["Light sting after serum", "Tiny bump near chin", "Felt dehydrated AM"][
              d % 3
            ];
    }

    await db.insert(dailyLogs).values({
      userId: patient.id,
      date,
      amRoutine: amDone,
      pmRoutine: pmDone,
      routineAmSteps: amSteps,
      routinePmSteps: pmSteps,
      mood:
        inBadStretch && !(amDone || pmDone)
          ? ["Low", "Tired", "Irritated"][d % 3]
          : inBadStretch
            ? ["Okay", "Stressed", "Low"][d % 3]
            : ["Focused", "Okay", "Relaxed"][d % 3],
      sleepHours,
      stressLevel,
      waterGlasses,
      journalEntry,
      sunExposure,
      dietType: d % 2 === 0 ? "mixed" : "vegetarian",
    });
  }

  await db.insert(appointments).values([
    {
      userId: patient.id,
      doctorId: doctor.id,
      dateTime: subDays(now, 20),
      status: "completed",
      type: "consultation",
    },
    {
      userId: patient.id,
      doctorId: doctor.id,
      dateTime: subDays(now, -5),
      status: "scheduled",
      type: "follow-up",
    },
  ]);

  await db.insert(visitNotes).values([
    {
      userId: patient.id,
      visitDate: subDays(now, 20),
      doctorName: "Dr. Ruby Sachdev",
      notes: "Pigmentation pattern is improving. Continue strict sunscreen and evening pigment protocol.",
      purpose: "Pigmentation follow-up",
      treatments: "Topical depigmenting blend",
      responseRating: "good",
    },
  ]);

  const [doctorThread] = await db
    .insert(chatThreads)
    .values({ userId: patient.id, assistantId: "doctor" })
    .returning({ id: chatThreads.id });
  if (doctorThread) {
    await db.insert(chatMessages).values([
      {
        threadId: doctorThread.id,
        sender: "patient",
        text: "Sharing this week's skin tracker updates before follow-up.",
      },
      {
        threadId: doctorThread.id,
        sender: "doctor",
        text: "Good progress. Keep AM/PM consistent and avoid new products this week.",
      },
    ]);
  }

  return {
    userId: patient.id,
    scansSeeded: scanIds.length,
    daysSeeded: daySpanHi + 1,
  };
}

if (require.main === module) {
  seedRagKaiDemoData()
    .then((r) => {
      console.log("RAG demo seed complete", r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

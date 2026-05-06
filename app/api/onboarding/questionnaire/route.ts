import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { questionnaireAnswers, skinDnaCards, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { notifyStaffQuestionnaireRedFlags } from "@/src/lib/questionnaireDoctorAlerts";

const ALLOWED_GENDERS = new Set(["female", "male", "other", "prefer_not_say"]);
const CONCERNS = new Set(["acne", "pigmentation", "ageing", "hair", "general"]);
const SEVERITY = new Set(["mild", "moderate", "severe"]);
const DURATION = new Set(["recent", "ongoing", "chronic"]);
const SENS = new Set(["low", "moderate", "high"]);
const SLEEP = new Set(["under5", "5to6", "7to8", "8plus"]);
const WATER = new Set(["under1l", "1to1_5l", "1_5to2l", "2lplus"]);
const DIET = new Set(["vegetarian", "vegan", "nonveg", "mixed"]);
const SUN = new Set(["minimal", "low", "moderate", "high"]);
const SKIN_TYPE = new Set(["Dry", "Oily", "Combination", "Normal", "Sensitive"]);
const PRIOR_TX = new Set(["yes", "no"]);
const PRIOR_TX_DUR = new Set([
  "under1m",
  "1to3m",
  "3to6m",
  "6to12m",
  "over1y",
]);

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [u] = await db
    .select({ id: users.id, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || u.role !== "patient") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  let age: number;
  if (typeof body.age === "number" && Number.isFinite(body.age)) {
    age = Math.round(body.age);
  } else if (typeof body.age === "string" && body.age.trim()) {
    age = Math.round(parseFloat(body.age.trim()));
  } else {
    return NextResponse.json(
      { error: "AGE_REQUIRED", message: "Please enter your age." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(age) || age < 1 || age > 120) {
    return NextResponse.json(
      { error: "INVALID_AGE", message: "Age must be between 1 and 120." },
      { status: 400 }
    );
  }

  const genderRaw =
    typeof body.gender === "string" ? body.gender.trim().toLowerCase() : "";
  if (!ALLOWED_GENDERS.has(genderRaw)) {
    return NextResponse.json(
      { error: "INVALID_GENDER", message: "Please select your gender." },
      { status: 400 }
    );
  }

  const primaryConcern =
    typeof body.primaryConcern === "string" ? body.primaryConcern : "";
  if (!CONCERNS.has(primaryConcern)) {
    return NextResponse.json(
      { error: "INVALID_CONCERN", message: "Invalid primary concern." },
      { status: 400 }
    );
  }

  const concernSeverity =
    typeof body.concernSeverity === "string" ? body.concernSeverity : "";
  const concernDuration =
    typeof body.concernDuration === "string" ? body.concernDuration : "";
  if (!SEVERITY.has(concernSeverity) || !DURATION.has(concernDuration)) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Severity and duration required." },
      { status: 400 }
    );
  }

  const triggers = Array.isArray(body.triggers)
    ? body.triggers.filter((x): x is string => typeof x === "string")
    : [];
  if (triggers.length < 1) {
    return NextResponse.json(
      { error: "TRIGGERS_REQUIRED", message: "Select at least one trigger." },
      { status: 400 }
    );
  }

  const priorTreatment =
    typeof body.priorTreatment === "string" ? body.priorTreatment : "";
  if (!PRIOR_TX.has(priorTreatment)) {
    return NextResponse.json(
      { error: "PRIOR_TX_REQUIRED" },
      { status: 400 }
    );
  }

  let treatmentHistoryText: string | null = null;
  let treatmentHistoryDuration: string | null = null;
  if (priorTreatment === "yes") {
    const txt =
      typeof body.treatmentHistoryText === "string"
        ? body.treatmentHistoryText.trim()
        : "";
    const dur =
      typeof body.treatmentHistoryDuration === "string"
        ? body.treatmentHistoryDuration.trim()
        : "";
    if (txt.length < 10 || !dur || !PRIOR_TX_DUR.has(dur)) {
      return NextResponse.json(
        {
          error: "TREATMENT_DETAIL_REQUIRED",
          message: "Describe prior treatments (min 10 chars) and select duration.",
        },
        { status: 400 }
      );
    }
    treatmentHistoryText = txt;
    treatmentHistoryDuration = dur;
  }

  const skinSensitivity =
    typeof body.skinSensitivity === "string" ? body.skinSensitivity : "";
  const baselineSleep =
    typeof body.baselineSleep === "string" ? body.baselineSleep : "";
  const baselineHydration =
    typeof body.baselineHydration === "string" ? body.baselineHydration : "";
  const baselineDietType =
    typeof body.baselineDietType === "string" ? body.baselineDietType : "";
  const baselineSunExposure =
    typeof body.baselineSunExposure === "string"
      ? body.baselineSunExposure
      : "";
  const skinType = typeof body.skinType === "string" ? body.skinType.trim() : "";

  if (
    !SENS.has(skinSensitivity) ||
    !SLEEP.has(baselineSleep) ||
    !WATER.has(baselineHydration) ||
    !DIET.has(baselineDietType) ||
    !SUN.has(baselineSunExposure) ||
    !SKIN_TYPE.has(skinType)
  ) {
    return NextResponse.json(
      { error: "LIFESTYLE_INCOMPLETE" },
      { status: 400 }
    );
  }

  const primaryGoalLabel =
    {
      acne: "Acne & breakouts",
      pigmentation: "Pigmentation & dark spots",
      ageing: "Ageing & wrinkles",
      hair: "Hair loss & scalp",
      general: "General skin health",
    }[primaryConcern] ?? primaryConcern;

  await db
    .update(users)
    .set({
      age,
      gender: genderRaw,
      primaryConcern,
      concernSeverity,
      concernDuration,
      triggers,
      priorTreatment,
      treatmentHistoryText,
      treatmentHistoryDuration,
      skinSensitivity,
      baselineSleep,
      baselineHydration,
      baselineDietType,
      baselineSunExposure,
      skinType,
      primaryGoal: primaryGoalLabel,
    })
    .where(eq(users.id, userId));

  const audit: Record<string, unknown> = {
    PROFILE_01: { age, gender: genderRaw },
    CONCERN_01: primaryConcern,
    SEV_01: concernSeverity,
    DUR_01: concernDuration,
    TRIG_01: triggers,
    TX_01: priorTreatment,
    SENS_01: skinSensitivity,
    LIFE_01: baselineSleep,
    LIFE_02a: baselineHydration,
    LIFE_02b: baselineDietType,
    LIFE_02c: baselineSunExposure,
  };
  if (priorTreatment === "yes") {
    audit.TX_02 = {
      text: treatmentHistoryText,
      duration: treatmentHistoryDuration,
    };
  }
  if (concernDuration === "chronic") {
    audit.FLAG_CHRONIC_CONCERN = {
      code: "chronic_duration",
      label: "Chronic concern",
      doctorNotified: true,
    };
  }
  if (skinSensitivity === "high") {
    audit.FLAG_HIGH_SENSITIVITY = {
      code: "high_sensitivity",
      label: "High sensitivity — review product prescription",
      doctorNotified: true,
    };
  }
  if (triggers.includes("unsure")) {
    audit.NOTE_Q4_TRIGGERS_UNSURE =
      "kAI will identify patterns from journal data";
  }
  if (baselineSleep === "under5") {
    audit.NOTE_Q7_SLEEP =
      "Poor sleep linked to elevated cortisol and skin inflammation";
  }

  for (const [questionId, answer] of Object.entries(audit)) {
    await db.insert(questionnaireAnswers).values({
      userId,
      questionId,
      answer: answer as Record<string, unknown>,
      questionnaireVersion: 1,
    });
  }

  const hormonal = triggers.includes("hormonal");
  const [existing] = await db
    .select()
    .from(skinDnaCards)
    .where(eq(skinDnaCards.userId, userId))
    .limit(1);
  if (existing) {
    await db
      .update(skinDnaCards)
      .set({
        primaryConcern: primaryGoalLabel,
        hormonalCorrelation: hormonal ? "Detected" : "Not indicated",
        revision: existing.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(skinDnaCards.userId, userId));
  } else {
    await db.insert(skinDnaCards).values({
      userId,
      primaryConcern: primaryGoalLabel,
      hormonalCorrelation: hormonal ? "Detected" : "Not indicated",
      revision: 1,
    });
  }

  try {
    await notifyStaffQuestionnaireRedFlags({
      patientId: userId,
      patientName: u.name?.trim() || "Patient",
      chronicConcern: concernDuration === "chronic",
      highSensitivity: skinSensitivity === "high",
    });
  } catch (e) {
    console.error("[onboarding/questionnaire] doctor alert notify failed", e);
  }

  return NextResponse.json({ ok: true });
}

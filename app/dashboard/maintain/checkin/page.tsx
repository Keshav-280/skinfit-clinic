import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db";
import { scans, users, wellnessCheckins } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import {
  primaryOnboardingConcern,
  userConcernsFromProfile,
} from "@/src/lib/onboardingConcerns";
import { resolveCheckinConcernPath } from "@/src/lib/checkin/definitions";
import type { CheckinAnswers } from "@/src/lib/checkin/types";
import { WeeklyCheckinFlow } from "@/components/checkin/WeeklyCheckinFlow";

export default async function WeeklyCheckinPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const initialEdit = sp.edit === "1" || sp.edit === "true";

  const [user, scanRow, weekRow] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        age: true,
        gender: true,
        primaryConcern: true,
        concerns: true,
      },
    }),
    db.query.scans.findFirst({
      where: eq(scans.userId, userId),
      columns: { id: true },
    }),
    (async () => {
      const weekYmd = format(
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );
      const [row] = await db
        .select()
        .from(wellnessCheckins)
        .where(
          and(
            eq(wellnessCheckins.userId, userId),
            eq(wellnessCheckins.weekYmd, weekYmd)
          )
        )
        .limit(1);
      return { weekYmd, row };
    })(),
  ]);

  if (!user) notFound();
  if (!scanRow) {
    redirect("/dashboard/scan");
  }

  const concernIds = userConcernsFromProfile({
    concerns: Array.isArray(user.concerns)
      ? (user.concerns as string[])
      : null,
    primaryConcern: user.primaryConcern,
  });
  const primary = primaryOnboardingConcern(concernIds);
  const concern = resolveCheckinConcernPath(
    user.primaryConcern,
    [primary, ...concernIds]
  );

  let existingAnswers: CheckinAnswers | null = null;
  if (weekRow.row?.payload && typeof weekRow.row.payload === "object") {
    const p = weekRow.row.payload as {
      universal?: {
        sleep_hours?: string;
        stress?: string;
        water?: string;
        nutrition?: string[];
        exercise_hours?: string;
        supplements?: string[];
      };
      concern_specific?: CheckinAnswers["concernSpecific"];
    };
    if (p.universal) {
      existingAnswers = {
        sleep_hours: p.universal.sleep_hours ?? null,
        stress: p.universal.stress ?? null,
        water: p.universal.water ?? null,
        nutrition: p.universal.nutrition ?? [],
        exercise_hours: p.universal.exercise_hours ?? null,
        supplements: p.universal.supplements ?? [],
        concernSpecific: p.concern_specific ?? {},
      };
    }
  } else if (weekRow.row) {
    existingAnswers = {
      sleep_hours: weekRow.row.sleepHours,
      stress: weekRow.row.stressAnchor,
      water: weekRow.row.water,
      nutrition: weekRow.row.nutritionMulti ?? [],
      exercise_hours: weekRow.row.exerciseHours,
      supplements: weekRow.row.supplementsList ?? [],
      concernSpecific: weekRow.row.concernSpecific ?? {},
    };
  }

  const existing =
    weekRow.row && existingAnswers
      ? {
          id: weekRow.row.id,
          answers: existingAnswers,
          submittedAt: weekRow.row.submittedAt?.toISOString() ?? null,
          flags: weekRow.row.flags ?? [],
        }
      : null;

  return (
    <WeeklyCheckinFlow
      weekYmd={weekRow.weekYmd}
      concern={concern}
      gender={user.gender}
      age={user.age}
      existing={existing}
      initialEdit={initialEdit}
    />
  );
}

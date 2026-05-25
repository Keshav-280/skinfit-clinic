import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { skinDnaCards, users } from "@/src/db/schema";

/** Marks questionnaire onboarding finished and syncs Skin DNA from profile fields. */
export async function finalizeOnboardingUser(userId: string): Promise<void> {
  const [u] = await db
    .select({
      skinType: users.skinType,
      skinSensitivity: users.skinSensitivity,
      baselineSunExposure: users.baselineSunExposure,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .update(users)
    .set({
      onboardingComplete: true,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (!u) return;

  const [dna] = await db
    .select()
    .from(skinDnaCards)
    .where(eq(skinDnaCards.userId, userId))
    .limit(1);

  const uvHigh =
    u.baselineSunExposure === "high" || u.baselineSunExposure === "moderate";
  const sensIdx =
    u.skinSensitivity === "high" ? 8 : u.skinSensitivity === "moderate" ? 5 : 3;

  if (dna) {
    await db
      .update(skinDnaCards)
      .set({
        skinType: u.skinType ?? dna.skinType,
        sensitivityIndex: sensIdx,
        uvSensitivity: uvHigh ? "High" : "Moderate",
        updatedAt: new Date(),
        revision: dna.revision + 1,
      })
      .where(eq(skinDnaCards.userId, userId));
  }
}

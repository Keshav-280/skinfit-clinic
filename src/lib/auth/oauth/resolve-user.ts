import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { oauthAccounts, users } from "@/src/db/schema";
import type { OAuthProfile, ResolveOAuthUserResult } from "@/src/lib/auth/oauth/types";

const MAX_NAME = 255;

function displayNameFromProfile(profile: OAuthProfile): string {
  const fromProfile = profile.name?.trim().slice(0, MAX_NAME);
  if (fromProfile) return fromProfile;
  const local = profile.email?.split("@")[0]?.trim();
  if (local) return local.slice(0, MAX_NAME);
  return "Patient";
}

/**
 * Find or create a patient user and link the OAuth account.
 * Reuses email/password users when the verified email matches.
 */
export async function resolveOAuthUser(
  profile: OAuthProfile
): Promise<ResolveOAuthUserResult> {
  const [existingLink] = await db
    .select({
      userId: oauthAccounts.userId,
      userRole: users.role,
      userEmail: users.email,
      userName: users.name,
      onboardingComplete: users.onboardingComplete,
    })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(
      and(
        eq(oauthAccounts.provider, profile.provider),
        eq(oauthAccounts.providerAccountId, profile.providerAccountId)
      )
    )
    .limit(1);

  if (existingLink) {
    if (existingLink.userRole !== "patient") {
      return {
        ok: false,
        code: "NOT_PATIENT",
        message: "This portal is for patients only.",
      };
    }
    await db
      .update(oauthAccounts)
      .set({
        providerEmail: profile.email,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(oauthAccounts.provider, profile.provider),
          eq(oauthAccounts.providerAccountId, profile.providerAccountId)
        )
      );
    return {
      ok: true,
      isNewUser: false,
      user: {
        id: existingLink.userId,
        email: existingLink.userEmail,
        name: existingLink.userName,
        role: existingLink.userRole,
        onboardingComplete: existingLink.onboardingComplete,
      },
    };
  }

  const normalizedEmail = profile.email?.toLowerCase() ?? null;

  if (normalizedEmail) {
    const [byEmail] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        onboardingComplete: users.onboardingComplete,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (byEmail) {
      if (byEmail.role !== "patient") {
        return {
          ok: false,
          code: "NOT_PATIENT",
          message: "This portal is for patients only.",
        };
      }
      await db.insert(oauthAccounts).values({
        userId: byEmail.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        providerEmail: profile.email,
      });
      return {
        ok: true,
        isNewUser: false,
        user: {
          id: byEmail.id,
          email: byEmail.email,
          name: byEmail.name,
          role: byEmail.role,
          onboardingComplete: byEmail.onboardingComplete,
        },
      };
    }
  }

  if (!normalizedEmail) {
    const emailMessages: Partial<Record<OAuthProfile["provider"], string>> = {
      apple:
        "We could not get an email from Apple. Use email sign-in or share email with Apple on first sign-in.",
      facebook:
        "We could not get an email from Facebook. Allow email access or use email sign-in.",
      google:
        "We could not get an email from Google. Allow email access or use email sign-in.",
    };
    return {
      ok: false,
      code: "EMAIL_REQUIRED",
      message:
        emailMessages[profile.provider] ??
        "We could not get an email from this provider. Use email sign-in.",
    };
  }

  const [inserted] = await db
    .insert(users)
    .values({
      name: displayNameFromProfile(profile),
      email: normalizedEmail,
      passwordHash: null,
      role: "patient",
      onboardingComplete: false,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      onboardingComplete: users.onboardingComplete,
    });

  if (!inserted) {
    return {
      ok: false,
      code: "CREATE_FAILED",
      message: "Could not create account.",
    };
  }

  await db.insert(oauthAccounts).values({
    userId: inserted.id,
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
    providerEmail: profile.email,
  });

  const { linkPendingClinicReportsForUser } = await import(
    "@/src/lib/clinicExternalReports"
  );
  void linkPendingClinicReportsForUser(inserted.id, inserted.email);

  return {
    ok: true,
    isNewUser: true,
    user: {
      id: inserted.id,
      email: inserted.email,
      name: inserted.name,
      role: inserted.role,
      onboardingComplete: inserted.onboardingComplete,
    },
  };
}

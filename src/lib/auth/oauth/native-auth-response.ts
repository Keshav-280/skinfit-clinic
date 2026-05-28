import { createSessionToken } from "@/src/lib/auth/session";
import { getSessionSecret } from "@/src/lib/auth/session-secret";

export async function buildNativeOAuthLoginPayload(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  onboardingComplete: boolean | null;
}): Promise<
  | {
      ok: true;
      token: string;
      user: {
        id: string;
        email: string;
        name: string;
        onboardingComplete: boolean;
        hasQuestionnaire: boolean;
        canAccessDashboard: boolean;
        hasBaselineScan: boolean;
      };
    }
  | { ok: false; message: string }
> {
  const secret = getSessionSecret();
  if (!secret) {
    return { ok: false, message: "Server configuration error." };
  }

  const token = await createSessionToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    secret
  );

  const { getOnboardingAccessForUser } = await import(
    "@/src/lib/onboardingAccess"
  );
  const access = await getOnboardingAccessForUser(user.id);

  return {
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      onboardingComplete: user.onboardingComplete ?? true,
      hasQuestionnaire: access.hasQuestionnaire,
      canAccessDashboard: access.canAccessDashboard,
      hasBaselineScan: access.hasBaselineScan,
    },
  };
}

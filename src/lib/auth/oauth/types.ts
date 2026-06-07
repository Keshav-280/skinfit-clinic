export type OAuthProvider =
  | "google"
  | "apple"
  | "facebook"
  | "github"
  | "microsoft";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  name: string | null;
};

export type ResolveOAuthUserResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        onboardingComplete: boolean | null;
      };
      isNewUser: boolean;
    }
  | { ok: false; code: string; message: string };

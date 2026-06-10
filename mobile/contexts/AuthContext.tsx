import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { apiUrl, networkFetchErrorMessage } from "@/lib/api";
import {
  signInWithOAuthNative,
  type NativeOAuthProvider,
} from "@/lib/oauthSignIn";
import { clearAllAppCaches, setCacheUserId } from "@/lib/apiCache";
import { clearAllCachedPhotos, setPhotoUserId } from "@/lib/profilePhoto";
import {
  registerForPushAndSyncToken,
  unregisterPushToken,
} from "@/lib/pushNotifications";
import {
  sessionDelete,
  sessionGet,
  sessionSet,
} from "@/lib/sessionStorageNativeOrWeb";
import { notifySessionExpired, setSessionExpiredHandler } from "@/lib/sessionExpired";

const TOKEN_KEY = "skinfit_session_token";
const USER_KEY = "skinfit_user_json";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  /** Questionnaire finished — unlocks Today’s focus and profile insights. */
  onboardingComplete?: boolean;
  hasQuestionnaire?: boolean;
  /** Baseline scan done or questionnaire complete — may open dashboard. */
  canAccessDashboard?: boolean;
  hasBaselineScan?: boolean;
  /** Baseline photos submitted; async scan job still running. */
  baselineScanPending?: boolean;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithEmailOtp: (email: string, otp: string) => Promise<void>;
  signInWithOAuth: (provider: NativeOAuthProvider) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    phone: string;
    phoneCountryCode?: string;
    password: string;
    otp?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  /** After profile save (email change issues a new JWT on native). */
  applySessionFromProfile: (data: {
    token?: string;
    user: { id: string; name: string; email: string };
  }) => Promise<void>;
  /** After baseline onboarding finishes — updates local session without re-login. */
  markOnboardingComplete: () => Promise<void>;
  /** Right after baseline photos upload — unlocks dashboard before profile cache catches up. */
  markBaselineSubmitted: (opts?: { pending?: boolean }) => Promise<void>;
  /** Refresh `user` from GET /api/user/profile (e.g. gate routing). */
  refreshUserFromProfile: (bearerToken: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, u] = await Promise.all([
          sessionGet(TOKEN_KEY),
          sessionGet(USER_KEY),
        ]);
        if (cancelled) return;
        setToken(t);
        if (u) {
          try {
            const parsed = JSON.parse(u) as AuthUser;
            setCacheUserId(parsed.id);
            setPhotoUserId(parsed.id);
            setUser(parsed);
          } catch {
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuthSession = useCallback(
    async (data: {
      token: string;
      user: AuthUser & { onboardingComplete?: boolean };
    }) => {
      const nextUser: AuthUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        onboardingComplete:
          typeof data.user.onboardingComplete === "boolean"
            ? data.user.onboardingComplete
            : true,
        hasQuestionnaire: data.user.hasQuestionnaire,
        canAccessDashboard: data.user.canAccessDashboard,
        hasBaselineScan: data.user.hasBaselineScan,
        baselineScanPending: data.user.baselineScanPending,
      };
      await sessionSet(TOKEN_KEY, data.token);
      await sessionSet(USER_KEY, JSON.stringify(nextUser));
      setCacheUserId(nextUser.id);
      setPhotoUserId(nextUser.id);
      setUser(nextUser);
      setToken(data.token);

      if (Platform.OS !== "web") {
        void registerForPushAndSyncToken(data.token, {
          verboseAlerts: true,
          requestPermission: true,
        });
      }
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Skinfit-Client": "native",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      throw new Error(networkFetchErrorMessage());
    }

    const text = await res.text().catch(() => "");
    let data: {
      ok?: boolean;
      token?: string;
      user?: AuthUser & { onboardingComplete?: boolean };
      message?: string;
      error?: string;
    } = {};
    try {
      data = text ? (JSON.parse(text) as typeof data) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `Sign in failed (HTTP ${res.status}). Server may be unavailable.`
      );
    }
    if (!data.token || !data.user) {
      throw new Error("Server did not return a session token.");
    }
    await applyAuthSession({ token: data.token, user: data.user });
  }, [applyAuthSession]);

  const signInWithEmailOtp = useCallback(
    async (email: string, otp: string) => {
      let res: Response;
      try {
        res = await fetch(apiUrl("/api/auth/login/verify-otp"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Skinfit-Client": "native",
          },
          body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
        });
      } catch {
        throw new Error(networkFetchErrorMessage());
      }

      const text = await res.text().catch(() => "");
      let data: {
        ok?: boolean;
        token?: string;
        user?: AuthUser & { onboardingComplete?: boolean };
        message?: string;
        error?: string;
      } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Sign in failed (HTTP ${res.status}). Server may be unavailable.`
        );
      }
      if (!data.token || !data.user) {
        throw new Error("Server did not return a session token.");
      }
      await applyAuthSession({ token: data.token, user: data.user });
    },
    [applyAuthSession]
  );

  const signInWithOAuth = useCallback(
    async (provider: NativeOAuthProvider) => {
      const credential = await signInWithOAuthNative(provider);

      if (credential.mobileWebSession) {
        await applyAuthSession({
          token: credential.mobileWebSession.token,
          user: credential.mobileWebSession.user,
        });
        return;
      }

      let res: Response;
      try {
        res = await fetch(apiUrl("/api/auth/oauth/native"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Skinfit-Client": "native",
          },
          body: JSON.stringify({
            provider: credential.provider,
            idToken: credential.idToken ?? undefined,
            code: credential.code ?? undefined,
            redirectUri: credential.redirectUri ?? undefined,
            name: credential.name ?? null,
          }),
        });
      } catch {
        throw new Error(networkFetchErrorMessage());
      }

      const text = await res.text().catch(() => "");
      let data: {
        ok?: boolean;
        token?: string;
        user?: AuthUser & { onboardingComplete?: boolean };
        message?: string;
        error?: string;
      } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Sign in failed (HTTP ${res.status}).`
        );
      }
      if (!data.token || !data.user) {
        throw new Error("Server did not return a session token.");
      }
      await applyAuthSession({ token: data.token, user: data.user });
    },
    [applyAuthSession]
  );

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      phoneCountryCode?: string;
      password: string;
      otp?: string;
    }) => {
      let res: Response;
      try {
        res = await fetch(apiUrl("/api/auth/register"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Skinfit-Client": "native",
          },
          body: JSON.stringify({
            name: input.name.trim(),
            email: input.email.trim(),
            password: input.password,
            phone: input.phone.trim(),
            phoneCountryCode: (input.phoneCountryCode || "+91").trim(),
            otp: input.otp?.trim() || "",
          }),
        });
      } catch {
        throw new Error(networkFetchErrorMessage());
      }

      const text = await res.text().catch(() => "");
      let data: {
        ok?: boolean;
        token?: string;
        user?: AuthUser & { onboardingComplete?: boolean };
        message?: string;
        error?: string;
      } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(
          data.message || data.error || `Sign up failed (HTTP ${res.status}).`
        );
      }
      if (!data.user) {
        throw new Error("Server did not return user details.");
      }

      let sessionToken = data.token;
      // Some deployments may return cookie-only register responses for native.
      // Fall back to login to obtain a bearer token for mobile session storage.
      if (!sessionToken) {
        try {
          const signInRes = await fetch(apiUrl("/api/auth/login"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Skinfit-Client": "native",
            },
            body: JSON.stringify({
              email: input.email.trim(),
              password: input.password,
            }),
          });
          const signInText = await signInRes.text().catch(() => "");
          let signInData: { token?: string; message?: string; error?: string } = {};
          try {
            signInData = signInText ? (JSON.parse(signInText) as typeof signInData) : {};
          } catch {
            signInData = {};
          }
          if (!signInRes.ok || !signInData.token) {
            throw new Error(
              signInData.message ||
                signInData.error ||
                `Sign in failed (HTTP ${signInRes.status}).`
            );
          }
          sessionToken = signInData.token;
        } catch (e) {
          throw new Error(
            e instanceof Error
              ? e.message
              : "Account created, but auto-login failed. Please sign in."
          );
        }
      }

      if (!sessionToken) {
        throw new Error("Account created, but session token is unavailable.");
      }

      const nextUser: AuthUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        onboardingComplete: false,
      };
      await sessionSet(TOKEN_KEY, sessionToken);
      await sessionSet(USER_KEY, JSON.stringify(nextUser));
      setCacheUserId(nextUser.id);
      setPhotoUserId(nextUser.id);
      setUser(nextUser);
      setToken(sessionToken);

      if (Platform.OS !== "web") {
        void registerForPushAndSyncToken(sessionToken, {
          verboseAlerts: true,
          requestPermission: true,
        });
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    const prevToken = token;
    if (prevToken && Platform.OS !== "web") {
      try {
        await unregisterPushToken(prevToken);
      } catch {
        /* offline or expired session — still sign out locally */
      }
    }
    await sessionDelete(TOKEN_KEY);
    await sessionDelete(USER_KEY);
    await clearAllCachedPhotos();
    await clearAllAppCaches();
    setCacheUserId(null);
    setPhotoUserId(null);
    setToken(null);
    setUser(null);
  }, [token]);

  useEffect(() => {
    setSessionExpiredHandler(() => signOut());
    return () => setSessionExpiredHandler(null);
  }, [signOut]);

  const markOnboardingComplete = useCallback(async () => {
    const u = user;
    if (!u) return;
    const next: AuthUser = {
      ...u,
      onboardingComplete: true,
      hasQuestionnaire: true,
      canAccessDashboard: true,
    };
    await sessionSet(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, [user]);

  const markBaselineSubmitted = useCallback(
    async (opts?: { pending?: boolean }) => {
      const u = user;
      if (!u) return;
      const pending = opts?.pending !== false;
      const next: AuthUser = {
        ...u,
        canAccessDashboard: true,
        baselineScanPending: pending,
        hasBaselineScan: !pending,
      };
      await sessionSet(USER_KEY, JSON.stringify(next));
      setUser(next);
    },
    [user]
  );

  const refreshUserFromProfile = useCallback(async (bearerToken: string) => {
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/user/profile"), {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "X-Skinfit-Client": "native",
        },
      });
    } catch {
      return;
    }
    const text = await res.text().catch(() => "");
    let data: { user?: AuthUser & { onboardingComplete?: boolean } } = {};
    try {
      data = text ? (JSON.parse(text) as typeof data) : {};
    } catch {
      return;
    }
    if (res.status === 401) {
      notifySessionExpired();
      return;
    }
    if (!data.user) return;
    const u = data.user as AuthUser;
    const next: AuthUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      onboardingComplete:
        typeof u.onboardingComplete === "boolean" ? u.onboardingComplete : true,
      hasQuestionnaire: u.hasQuestionnaire,
      canAccessDashboard: u.canAccessDashboard,
      hasBaselineScan: u.hasBaselineScan,
      baselineScanPending: u.baselineScanPending,
    };
    await sessionSet(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const applySessionFromProfile = useCallback(
    async (data: {
      token?: string;
      user: { id: string; name: string; email: string };
    }) => {
      if (data.token) {
        await sessionSet(TOKEN_KEY, data.token);
        setToken(data.token);
        if (Platform.OS !== "web") {
          void registerForPushAndSyncToken(data.token, {
            verboseAlerts: false,
            requestPermission: true,
          });
        }
      }
      const next: AuthUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        onboardingComplete: user?.onboardingComplete ?? true,
      };
      await sessionSet(USER_KEY, JSON.stringify(next));
      setUser(next);
    },
    [user?.onboardingComplete]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      signIn,
      signInWithEmailOtp,
      signInWithOAuth,
      signUp,
      signOut,
      applySessionFromProfile,
      markOnboardingComplete,
      markBaselineSubmitted,
      refreshUserFromProfile,
    }),
    [
      token,
      user,
      ready,
      signIn,
      signInWithEmailOtp,
      signInWithOAuth,
      signUp,
      signOut,
      applySessionFromProfile,
      markOnboardingComplete,
      markBaselineSubmitted,
      refreshUserFromProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

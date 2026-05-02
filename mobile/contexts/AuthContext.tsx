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

import { apiUrl } from "@/lib/api";
import {
  registerForPushAndSyncToken,
  unregisterPushToken,
} from "@/lib/pushNotifications";
import {
  sessionDelete,
  sessionGet,
  sessionSet,
} from "@/lib/sessionStorageNativeOrWeb";

const TOKEN_KEY = "skinfit_session_token";
const USER_KEY = "skinfit_user_json";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  /** When false, patient should complete kAI onboarding (native). */
  onboardingComplete?: boolean;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** After profile save (email change issues a new JWT on native). */
  applySessionFromProfile: (data: {
    token?: string;
    user: { id: string; name: string; email: string };
  }) => Promise<void>;
  /** After baseline onboarding finishes — updates local session without re-login. */
  markOnboardingComplete: () => Promise<void>;
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
            setUser(JSON.parse(u) as AuthUser);
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
      throw new Error(
        "Cannot reach the server. Check your internet and EXPO_PUBLIC_API_URL."
      );
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
    const nextUser: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      onboardingComplete:
        typeof data.user.onboardingComplete === "boolean"
          ? data.user.onboardingComplete
          : true,
    };
    await sessionSet(TOKEN_KEY, data.token);
    await sessionSet(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setToken(data.token);

    if (Platform.OS !== "web") {
      void registerForPushAndSyncToken(data.token, {
        verboseAlerts: false,
        requestPermission: true,
      });
    }
  }, []);

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
    setToken(null);
    setUser(null);
  }, [token]);

  const markOnboardingComplete = useCallback(async () => {
    const u = user;
    if (!u) return;
    const next: AuthUser = { ...u, onboardingComplete: true };
    await sessionSet(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, [user]);

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
    if (!data.user) return;
    const next: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      onboardingComplete:
        typeof data.user.onboardingComplete === "boolean"
          ? data.user.onboardingComplete
          : true,
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
      signOut,
      applySessionFromProfile,
      markOnboardingComplete,
      refreshUserFromProfile,
    }),
    [
      token,
      user,
      ready,
      signIn,
      signOut,
      applySessionFromProfile,
      markOnboardingComplete,
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

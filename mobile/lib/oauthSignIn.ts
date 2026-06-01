import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform, TurboModuleRegistry } from "react-native";

import { apiUrl } from "@/lib/api";
import { decodeBase64UrlToUtf8 } from "@/lib/base64UrlDecode";

export type NativeOAuthProvider = "google" | "apple";

export type NativeOAuthMobileSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    onboardingComplete?: boolean;
    hasQuestionnaire?: boolean;
    canAccessDashboard?: boolean;
    hasBaselineScan?: boolean;
  };
};

export type NativeOAuthCredential = {
  provider: NativeOAuthProvider;
  idToken?: string;
  /** Filled when Google sign-in completes via in-app browser (no native RNGoogleSignin). */
  mobileWebSession?: NativeOAuthMobileSession;
  /** Apple OAuth on Android (authorization code). */
  code?: string;
  redirectUri?: string;
  /** Apple may send name only on the first authorization. */
  name?: string | null;
};

let googleConfigured = false;

WebBrowser.maybeCompleteAuthSession();

function googleWebClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
}

function googleIosClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
}

function isGoogleSignInNativeModuleLinked(): boolean {
  if (Platform.OS === "web") return false;
  return TurboModuleRegistry.get("RNGoogleSignin") != null;
}

/**
 * @react-native-google-signin requires `webClientId` (Google Cloud **Web application**
 * OAuth client ID) on every platform — it is used to obtain a verifiable idToken.
 * `iosClientId` is optional and only supplements the native iOS flow.
 */
export type GoogleSignInConfigStatus =
  | "ready"
  | "needs_web_client_id"
  | "needs_native_build"
  | "hidden";

export function getGoogleSignInConfigStatus(): GoogleSignInConfigStatus {
  if (!googleWebClientId()) {
    if (Platform.OS === "ios" && googleIosClientId()) return "needs_web_client_id";
    // Native id not in env — still allow sign-in via in-app browser → server OAuth.
    return "needs_native_build";
  }
  if (!isGoogleSignInNativeModuleLinked()) return "needs_native_build";
  return "ready";
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(googleWebClientId());
}

export function isGoogleSignInNativeReady(): boolean {
  return getGoogleSignInConfigStatus() === "ready";
}

export function googleSignInConfigHint(): string | null {
  const status = getGoogleSignInConfigStatus();
  if (status === "needs_web_client_id") {
    return "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Web OAuth client) in mobile/.env — required even when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set.";
  }
  if (status === "needs_native_build") {
    return "Google needs a dev build (not Expo Go). From mobile/: npx expo run:ios — then open that app. Or use browser sign-in below.";
  }
  return null;
}

export const GOOGLE_SIGNIN_REBUILD_HINT =
  "Rebuild the app so Google Sign-In native code is included: cd mobile && npx expo run:ios (or run:android). Restart Metro with npx expo start -c.";

type GoogleSignInSdk = {
  GoogleSignin: {
    configure: (options: {
      webClientId: string;
      iosClientId?: string;
      offlineAccess?: boolean;
    }) => void;
    hasPlayServices: (options: {
      showPlayServicesUpdateDialog: boolean;
    }) => Promise<boolean>;
    signIn: () => Promise<
      | { type: "cancelled" }
      | { type: "success"; data: { idToken: string | null } }
    >;
    getTokens: () => Promise<{ idToken: string | null }>;
  };
  statusCodes: { SIGN_IN_CANCELLED: string; IN_PROGRESS: string };
};

async function loadGoogleSignInSdk(): Promise<GoogleSignInSdk | null> {
  if (!isGoogleSignInNativeModuleLinked()) return null;
  try {
    const mod = await import("@react-native-google-signin/google-signin");
    const GoogleSignin = mod.GoogleSignin;
    if (GoogleSignin && typeof GoogleSignin.configure === "function") {
      return { GoogleSignin, statusCodes: mod.statusCodes };
    }
  } catch {
    /* native module not in this binary */
  }
  return null;
}

export async function configureGoogleSignIn(): Promise<void> {
  if (googleConfigured || !googleWebClientId()) return;
  if (Platform.OS === "web") return;

  const sdk = await loadGoogleSignInSdk();
  if (!sdk) return;

  sdk.GoogleSignin.configure({
    webClientId: googleWebClientId(),
    iosClientId: googleIosClientId() || undefined,
    offlineAccess: false,
  });
  googleConfigured = true;
}

function parseMobileGoogleHandoffUrl(
  url: string
): NativeOAuthMobileSession | { error: string } {
  const parsed = Linking.parse(url);
  const oauthError =
    typeof parsed.queryParams?.oauth_error === "string"
      ? parsed.queryParams.oauth_error
      : Array.isArray(parsed.queryParams?.oauth_error)
        ? parsed.queryParams.oauth_error[0]
        : null;
  if (oauthError) {
    const message =
      typeof parsed.queryParams?.message === "string"
        ? parsed.queryParams.message
        : "Google sign-in failed.";
    return { error: message };
  }

  const tokenRaw = parsed.queryParams?.token;
  const userRaw = parsed.queryParams?.user;
  const token =
    typeof tokenRaw === "string"
      ? decodeURIComponent(tokenRaw)
      : Array.isArray(tokenRaw)
        ? decodeURIComponent(tokenRaw[0] ?? "")
        : null;
  const userB64 =
    typeof userRaw === "string"
      ? decodeURIComponent(userRaw)
      : Array.isArray(userRaw)
        ? decodeURIComponent(userRaw[0] ?? "")
        : null;

  if (!token || !userB64) {
    return { error: "Google sign-in did not return a session." };
  }

  try {
    const userJson = decodeBase64UrlToUtf8(userB64);
    const user = JSON.parse(userJson) as NativeOAuthMobileSession["user"];
    if (!user?.id || !user?.email) {
      return { error: "Invalid session payload from Google sign-in." };
    }
    return { token, user };
  } catch (e) {
    if (__DEV__) {
      console.warn("[oauth] parseMobileGoogleHandoffUrl failed", e, url.slice(0, 120));
    }
    return { error: "Could not read Google sign-in response." };
  }
}

async function signInWithGoogleWebBrowser(): Promise<NativeOAuthCredential> {
  const returnUri = Linking.createURL("oauth/google");
  const startUrl = apiUrl(
    `/api/auth/oauth/google?mobile_return=${encodeURIComponent(returnUri)}`
  );

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUri);
  if (result.type !== "success" || !result.url) {
    throw new Error("Google sign-in was cancelled.");
  }

  const session = parseMobileGoogleHandoffUrl(result.url);
  if ("error" in session) {
    throw new Error(session.error);
  }

  return {
    provider: "google",
    mobileWebSession: session,
  };
}

async function signInWithGoogleNativeSdk(): Promise<NativeOAuthCredential> {
  await configureGoogleSignIn();

  const sdk = await loadGoogleSignInSdk();
  if (!sdk) {
    throw new Error(
      `${GOOGLE_SIGNIN_REBUILD_HINT} Or sign in will use the browser automatically.`
    );
  }

  const { GoogleSignin, statusCodes } = sdk;

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    const result = await GoogleSignin.signIn();
    if (result.type === "cancelled") {
      throw new Error("Google sign-in was cancelled.");
    }

    let idToken = result.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      throw new Error("Google did not return an identity token.");
    }
    return { provider: "google", idToken };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "";
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google sign-in was cancelled.");
    }
    if (code === statusCodes.IN_PROGRESS) {
      throw new Error("Google sign-in is already in progress.");
    }
    throw new Error(
      e instanceof Error ? e.message : "Google sign-in failed."
    );
  }
}

export async function signInWithGoogleNative(): Promise<NativeOAuthCredential> {
  if (!isGoogleSignInConfigured()) {
    return signInWithGoogleWebBrowser();
  }

  if (isGoogleSignInNativeModuleLinked()) {
    try {
      return await signInWithGoogleNativeSdk();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (
        !msg.includes("configure") &&
        !msg.includes("RNGoogleSignin") &&
        !msg.includes("native module")
      ) {
        throw e;
      }
    }
  }

  return signInWithGoogleWebBrowser();
}

export function isAppleWebSignInConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_APPLE_SERVICES_ID?.trim());
}

export function appleOAuthRedirectUri(): string {
  return Linking.createURL("oauth/apple");
}

export function isAppleSignInAvailable(): boolean {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGNIN === "1";
  }
  return Platform.OS === "android" && isAppleWebSignInConfigured();
}

async function signInWithAppleIosNative(): Promise<NativeOAuthCredential> {
  const AppleAuthentication = await import("expo-apple-authentication");
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error("Sign in with Apple is not available on this device.");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    const parts: string[] = [];
    if (credential.fullName?.givenName) {
      parts.push(credential.fullName.givenName);
    }
    if (credential.fullName?.familyName) {
      parts.push(credential.fullName.familyName);
    }
    const name = parts.length ? parts.join(" ").trim() : null;

    return {
      provider: "apple",
      idToken: credential.identityToken,
      name,
    };
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      throw new Error("Apple sign-in was cancelled.");
    }
    throw new Error(
      e instanceof Error ? e.message : "Apple sign-in failed."
    );
  }
}

async function signInWithAppleAndroidWeb(): Promise<NativeOAuthCredential> {
  if (!isAppleWebSignInConfigured()) {
    throw new Error(
      "Apple sign-in is not configured. Set EXPO_PUBLIC_APPLE_SERVICES_ID in mobile/.env."
    );
  }

  const clientId = process.env.EXPO_PUBLIC_APPLE_SERVICES_ID!.trim();
  const redirectUri = appleOAuthRedirectUri();
  const state = Math.random().toString(36).slice(2);

  const authUrl = new URL("https://appleid.apple.com/auth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "name email");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("state", state);

  const result = await WebBrowser.openAuthSessionAsync(
    authUrl.toString(),
    redirectUri
  );

  if (result.type !== "success" || !result.url) {
    throw new Error("Apple sign-in was cancelled.");
  }

  const parsed = Linking.parse(result.url);
  const code =
    typeof parsed.queryParams?.code === "string"
      ? parsed.queryParams.code
      : Array.isArray(parsed.queryParams?.code)
        ? parsed.queryParams.code[0]
        : null;

  if (!code) {
    const err =
      typeof parsed.queryParams?.error === "string"
        ? parsed.queryParams.error
        : "Apple sign-in failed.";
    throw new Error(err);
  }

  return {
    provider: "apple",
    code,
    redirectUri,
  };
}

export async function signInWithAppleNative(): Promise<NativeOAuthCredential> {
  if (Platform.OS === "android") {
    return signInWithAppleAndroidWeb();
  }
  if (Platform.OS !== "ios") {
    throw new Error("Sign in with Apple is not available on this platform.");
  }
  return signInWithAppleIosNative();
}

export async function signInWithOAuthNative(
  provider: NativeOAuthProvider
): Promise<NativeOAuthCredential> {
  if (provider === "google") {
    return signInWithGoogleNative();
  }
  return signInWithAppleNative();
}

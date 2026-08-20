"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { OAuthLoginDivider } from "@/components/auth/OAuthLoginDivider";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { DEMO_LOGIN_EMAIL } from "@/src/lib/auth/demo-login";

const NAVY_PANEL =
  "bg-gradient-to-br from-[#1a2544] via-[#2C3E6B] to-[#162038]";

const LABEL = "mb-2 block text-sm font-semibold text-[#1E232C]";
const INPUT =
  "w-full rounded-lg border border-transparent bg-[#F7F8F9] px-4 py-3.5 text-[15px] text-[#1E232C] outline-none transition placeholder:text-[#8391A1] focus:border-[#525FE1]/30 focus:ring-2 focus:ring-[#525FE1]/15";
const ERROR =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800";
const EYE_BTN =
  "absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#8391A1] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60";

type Mode = "signin" | "register";
type SignInMethod = "password" | "otp";

function postAuthDestination(
  next: string | null,
  onboardingComplete: boolean | undefined
): string {
  if (next && next.startsWith("/")) return next;
  if (onboardingComplete === false) return "/onboarding/kai-intro";
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "register" ? "register" : "signin"
  );
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetErrors = useCallback(() => setError(null), []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    const oauthMessage = searchParams.get("oauth_message");
    if (searchParams.get("oauth_error") && oauthMessage) {
      setError(oauthMessage);
      const qs = new URLSearchParams(searchParams.toString());
      qs.delete("oauth_error");
      qs.delete("oauth_message");
      const next = qs.toString();
      router.replace(next ? `/login?${next}` : "/login", { scroll: false });
    }
  }, [router, searchParams]);

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setError(null);
      setPhoneCountryCode("+91");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setOtp("");
      setOtpSent(false);
      setOtpHint(null);
      setResendSeconds(0);
      setSignInMethod("password");
      const qs = new URLSearchParams();
      if (next === "register") qs.set("mode", "register");
      const n = searchParams.get("next");
      if (n) qs.set("next", n);
      const q = qs.toString();
      router.replace(q ? `/login?${q}` : "/login", { scroll: false });
    },
    [router, searchParams]
  );

  async function onSubmitSignIn(e: React.FormEvent) {
    e.preventDefault();
    resetErrors();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: unknown;
        error?: unknown;
        user?: { onboardingComplete?: boolean };
      };
      if (!res.ok) {
        const fromApi =
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error.replace(/_/g, " ")
              : null;
        setError(
          fromApi ??
            (res.status >= 500
              ? `Server error (${res.status}). Check the terminal or hosting logs.`
              : "Something went wrong. Please try again.")
        );
        return;
      }
      router.push(
        postAuthDestination(searchParams.get("next"), data.user?.onboardingComplete)
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetSignInOtpState() {
    setOtp("");
    setOtpSent(false);
    setOtpHint(null);
    setResendSeconds(0);
  }

  async function sendLoginOtp() {
    resetErrors();
    setOtpHint(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email before requesting a sign-in code.");
      return;
    }
    setSendOtpLoading(true);
    try {
      const res = await fetch("/api/auth/login/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        retryAfterSeconds?: number;
        cooldownSeconds?: number;
      };
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Could not send sign-in code."
        );
        if (typeof data.retryAfterSeconds === "number") {
          setResendSeconds(data.retryAfterSeconds);
        }
        return;
      }
      setOtpSent(true);
      setOtp("");
      setOtpHint(
        typeof data.message === "string"
          ? data.message
          : "Sign-in code sent. Check your inbox."
      );
      setResendSeconds(
        typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSendOtpLoading(false);
    }
  }

  async function onSubmitSignInOtp(e: React.FormEvent) {
    e.preventDefault();
    resetErrors();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email.");
      return;
    }
    if (!otpSent) {
      setError("Send a sign-in code to your email first.");
      return;
    }
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, otp: otp.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        user?: { onboardingComplete?: boolean };
      };
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error.replace(/_/g, " ")
              : "Could not sign in with that code."
        );
        return;
      }
      router.push(
        postAuthDestination(searchParams.get("next"), data.user?.onboardingComplete)
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendSignupOtp() {
    resetErrors();
    setOtpHint(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email before requesting a verification code.");
      return;
    }
    setSendOtpLoading(true);
    try {
      const res = await fetch("/api/auth/signup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        retryAfterSeconds?: number;
        cooldownSeconds?: number;
      };
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Could not send verification code."
        );
        if (typeof data.retryAfterSeconds === "number") {
          setResendSeconds(data.retryAfterSeconds);
        }
        return;
      }
      setOtpSent(true);
      setOtp("");
      setOtpHint(
        typeof data.message === "string"
          ? data.message
          : "Verification code sent. Check your inbox."
      );
      setResendSeconds(
        typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSendOtpLoading(false);
    }
  }

  async function onSubmitRegister(e: React.FormEvent) {
    e.preventDefault();
    resetErrors();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phoneCountryCode: phoneCountryCode.trim() || "+91",
          phone: phone.trim(),
          password,
          otp: otp.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        user?: { onboardingComplete?: boolean };
      };
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Could not create account. Please try again."
        );
        return;
      }
      router.push(
        postAuthDestination(searchParams.get("next"), data.user?.onboardingComplete)
      );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const isSignIn = mode === "signin";

  return (
    <div className="flex min-h-screen">
      <div
        className={`relative hidden min-h-screen flex-1 flex-col justify-between overflow-hidden px-12 py-16 lg:flex ${NAVY_PANEL}`}
      >
        {/* Ambient rings — kAI face-analysis motif */}
        <svg
          className="pointer-events-none absolute -right-24 top-1/2 h-[680px] w-[680px] -translate-y-1/2 opacity-[0.14]"
          viewBox="0 0 600 600"
          fill="none"
          aria-hidden
        >
          <circle cx="300" cy="300" r="290" stroke="#F5F3EF" strokeWidth="1" />
          <circle cx="300" cy="300" r="230" stroke="#F5F3EF" strokeWidth="1" />
          <circle cx="300" cy="300" r="170" stroke="#F5F3EF" strokeWidth="1" />
          <circle cx="300" cy="300" r="110" stroke="#F5F3EF" strokeWidth="1" />
          <circle cx="300" cy="300" r="50" stroke="#F5F3EF" strokeWidth="1" />
        </svg>
        <div
          className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #F5F3EF 0%, transparent 65%)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #C9A876 0%, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative z-10">
          <Image
            src="/branding/skinfit-wellness-logo.svg"
            alt="SkinFit Wellness"
            width={560}
            height={135}
            priority
            className="h-11 w-auto max-w-[15rem] brightness-0 invert"
          />
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
            AI-guided skincare
          </p>
          <h2 className="font-serif text-4xl font-semibold leading-[1.15] text-white xl:text-5xl">
            Beautiful skin, built with intelligence.
          </h2>
          <p className="text-base leading-relaxed text-white/70">
            {isSignIn
              ? "Continue your journey. Track your skin, your routines, and your progress — all in one private dashboard."
              : "Join the SkinFit patient portal. Get an AI skin analysis, a personalised care plan, and doctor-guided support."}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              AI skin analysis
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Doctor-guided care
            </span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © SkinFit Wellness · Private patient portal
        </div>
      </div>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-white px-6 py-12 text-[#1E232C]">
        <div className="w-full max-w-md">
        {isSignIn ? (
          <div className="mb-8">
            <div className="mb-6 flex justify-center lg:hidden">
              <Image
                src="/branding/skinfit-wellness-logo.svg"
                alt="SkinFit Wellness"
                width={560}
                height={135}
                priority
                className="h-9 w-auto max-w-[11rem]"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1E232C]">
              Welcome back!{" "}
              <span aria-hidden className="inline-block">
                👋
              </span>
            </h1>
            <p className="mt-2 text-[15px] text-[#8391A1]">
              Glad to see you, Again!
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#1E232C] shadow-sm transition hover:bg-[#F7F8F9]"
              aria-label="Back to sign in"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-[#1E232C]">
              Hello! Register to get started
            </h1>
            <p className="mt-2 text-[15px] text-[#8391A1]">
              Join the private patient portal
            </p>
          </div>
        )}

        {isSignIn ? (
          <>
            <SocialLoginButtons disabled={loading} variant="light" compact />
            <OAuthLoginDivider
              variant="light"
              label="OR LOG IN WITH"
            />
            <form
              onSubmit={
                signInMethod === "otp" ? onSubmitSignInOtp : onSubmitSignIn
              }
              className="space-y-5"
            >
              {error ? (
                <div role="alert" className={ERROR}>
                  {error}
                </div>
              ) : null}

              <div>
                <label htmlFor="email" className={LABEL}>
                  Email
                </label>
                {signInMethod === "otp" ? (
                  <div className="flex gap-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        resetSignInOtpState();
                      }}
                      disabled={loading || sendOtpLoading}
                      className={`min-w-0 flex-1 ${INPUT}`}
                      placeholder={DEMO_LOGIN_EMAIL}
                    />
                    <button
                      type="button"
                      onClick={sendLoginOtp}
                      disabled={
                        loading || sendOtpLoading || resendSeconds > 0
                      }
                      className="shrink-0 rounded-lg bg-[#F7F8F9] px-3 py-3 text-sm font-semibold text-[#525FE1] transition hover:bg-[#eef0f2] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendOtpLoading
                        ? "Sending…"
                        : resendSeconds > 0
                          ? `${resendSeconds}s`
                          : otpSent
                            ? "Resend"
                            : "Send code"}
                    </button>
                  </div>
                ) : (
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className={INPUT}
                    placeholder={DEMO_LOGIN_EMAIL}
                  />
                )}
                {signInMethod === "otp" && otpHint ? (
                  <p className="mt-1.5 text-xs text-emerald-600">{otpHint}</p>
                ) : null}
              </div>

              {signInMethod === "otp" ? (
                <div>
                  <label htmlFor="signin-otp" className={LABEL}>
                    Email sign-in code
                  </label>
                  <input
                    id="signin-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    disabled={loading}
                    className={INPUT}
                    placeholder="6-digit code from email"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="password" className={LABEL}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className={`${INPUT} pr-11`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
                      className={EYE_BTN}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetErrors();
                        resetSignInOtpState();
                        setSignInMethod("otp");
                      }}
                      className="text-sm font-semibold text-[#525FE1] hover:underline"
                    >
                      Send a code to your email instead
                    </button>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-semibold text-[#525FE1] hover:underline"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </div>
              )}

              {signInMethod === "otp" ? (
                <button
                  type="button"
                  onClick={() => {
                    resetErrors();
                    resetSignInOtpState();
                    setSignInMethod("password");
                  }}
                  className="text-sm font-semibold text-[#525FE1] hover:underline"
                >
                  Use password instead
                </button>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-full bg-[#525FE1] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#454ecc] focus:outline-none focus:ring-2 focus:ring-[#525FE1]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Signing in…"
                  : signInMethod === "otp"
                    ? "Sign in with code"
                    : "Sign In"}
              </button>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={onSubmitRegister} className="space-y-5">
              {error ? (
                <div role="alert" className={ERROR}>
                  {error}
                </div>
              ) : null}

              <div>
                <label htmlFor="name" className={LABEL}>
                  Username
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className={INPUT}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className={LABEL}>
                  Email
                </label>
                <div className="flex gap-2">
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setOtpSent(false);
                      setOtp("");
                      setOtpHint(null);
                    }}
                    disabled={loading}
                    className={`min-w-0 flex-1 ${INPUT}`}
                    placeholder="you@gmail.com"
                  />
                  <button
                    type="button"
                    onClick={sendSignupOtp}
                    disabled={loading || sendOtpLoading || resendSeconds > 0}
                    className="shrink-0 rounded-lg bg-[#F7F8F9] px-3 py-3 text-sm font-semibold text-[#525FE1] transition hover:bg-[#eef0f2] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendOtpLoading
                      ? "Sending…"
                      : resendSeconds > 0
                        ? `${resendSeconds}s`
                        : otpSent
                          ? "Resend"
                          : "Send code"}
                  </button>
                </div>
                {otpHint ? (
                  <p className="mt-1.5 text-xs text-emerald-600">{otpHint}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="reg-otp" className={LABEL}>
                  Email verification code
                </label>
                <input
                  id="reg-otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={loading}
                  className={INPUT}
                  placeholder="6-digit code from email"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className={LABEL}>
                  Phone number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="reg-phone-cc"
                    name="phoneCountryCode"
                    type="text"
                    autoComplete="tel-country-code"
                    required
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    disabled={loading}
                    className="w-[5.5rem] shrink-0 rounded-lg border border-transparent bg-[#F7F8F9] px-3 py-3.5 text-center text-[#1E232C] outline-none transition focus:border-[#525FE1]/30 focus:ring-2 focus:ring-[#525FE1]/15"
                    placeholder="+91"
                    aria-label="Country code"
                  />
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    className={`min-w-0 flex-1 ${INPUT}`}
                    placeholder="10-digit mobile"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className={LABEL}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className={`${INPUT} pr-11`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    className={EYE_BTN}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className={LABEL}>
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className={`${INPUT} pr-11`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    disabled={loading}
                    className={EYE_BTN}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg bg-[#1E232C] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#2a3038] focus:outline-none focus:ring-2 focus:ring-[#1E232C]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Register"}
              </button>
            </form>

            <OAuthLoginDivider variant="light" label="Or Register with" />
            <SocialLoginButtons disabled={loading} variant="light" />
          </>
        )}

        <p className="mt-8 text-center text-sm text-[#8391A1]">
          {isSignIn ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-[#525FE1] hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-semibold text-[#35B9B1] hover:underline"
              >
                Login Now
              </button>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-xs text-[#8391A1]">
          Clinic staff?{" "}
          <Link
            href="/doctor/login"
            className="font-semibold text-[#35B9B1] hover:underline"
          >
            Doctor portal
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}

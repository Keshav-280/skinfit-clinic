"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { OAuthLoginDivider } from "@/components/auth/OAuthLoginDivider";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { LoginIntroSplash } from "@/components/login/LoginIntroSplash";
import { DEMO_LOGIN_EMAIL } from "@/src/lib/auth/demo-login";

const easeOut = [0.22, 1, 0.36, 1] as const;

const LABEL = "mb-2 block text-sm font-semibold text-[#1E1B31]";
const INPUT =
  "w-full rounded-lg border border-transparent bg-[#F0EAE2] px-4 py-3.5 text-[15px] text-[#1E1B31] outline-none transition placeholder:text-[#5B66A1] focus:border-[#1E1B31]/30 focus:ring-2 focus:ring-[#1E1B31]/15";
const ERROR =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800";
const EYE_BTN =
  "absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#5B66A1] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60";

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
  // Splash plays once per browser session; the real page mounts immediately
  // underneath it (logo shares a layoutId so it "hands off" smoothly), and
  // everything else fades/slides in once the splash finishes.
  const [introShowing, setIntroShowing] = useState(true);

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {introShowing ? (
        <LoginIntroSplash onDone={() => setIntroShowing(false)} />
      ) : null}

      {/* Visual panel - photo. Mobile: hero on top with curved base. Desktop: right half. */}
      <div className="relative order-1 h-[60vh] min-h-[380px] w-full overflow-hidden lg:h-auto lg:min-h-screen lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={introShowing ? {} : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="absolute inset-0"
        >
          <Image
            src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1400&q=80&auto=format&fit=crop"
            alt="Skincare treatment at SkinFit Wellness"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
          {/* Scrim for text legibility - top on mobile, bottom on desktop */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1E1B31]/75 via-[#1E1B31]/10 to-transparent lg:bg-gradient-to-t lg:from-[#1E1B31]/80 lg:via-[#1E1B31]/10 lg:to-[#1E1B31]/25" />
        </motion.div>

        {/* Brand + tagline overlay */}
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center px-6 pt-8 text-center lg:inset-auto lg:bottom-0 lg:left-0 lg:right-0 lg:items-start lg:p-12 lg:text-left">
          <motion.div layoutId="app-logo" transition={{ duration: 0.6, ease: easeOut }}>
            <Image
              src="/branding/skinfit-wellness-logo.svg"
              alt="SkinFit Wellness"
              width={560}
              height={135}
              priority
              className="h-9 w-auto max-w-[12rem] brightness-0 invert lg:h-11 lg:max-w-[15rem]"
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={introShowing ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeOut }}
            className="font-tenor mt-3 max-w-xs text-sm font-medium text-white/85 lg:mt-4 lg:max-w-md lg:text-xl lg:leading-relaxed"
          >
            Because your skin deserves the best care.
          </motion.p>
        </div>

        {/* Concave white base - mobile only, echoes the reference curve */}
        <div className="pointer-events-none absolute -bottom-2 left-1/2 z-20 h-14 w-[160%] -translate-x-1/2 rounded-[100%] bg-white lg:hidden" />
      </div>

      {/* Form panel - left on desktop, below the hero on mobile */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={introShowing ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
        className="order-2 flex flex-1 items-center justify-center bg-[#FAF8F5] px-6 py-10 text-[#1E1B31] lg:min-h-screen lg:py-12"
      >
        <div className="w-full max-w-md">
        {isSignIn ? (
          <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-[#1E1B31]">
              Welcome back!{" "}
              <span aria-hidden className="inline-block">
                👋
              </span>
            </h1>
            <p className="mt-2 text-[15px] text-[#5B66A1]">
              Glad to see you, Again!
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#1E1B31] shadow-sm transition hover:bg-[#F0EAE2]"
              aria-label="Back to sign in"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-[#1E1B31]">
              Hello! Register to get started
            </h1>
            <p className="mt-2 text-[15px] text-[#5B66A1]">
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
                      className="shrink-0 rounded-lg bg-[#F0EAE2] px-3 py-3 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#eef0f2] disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="text-sm font-semibold text-[#1E1B31] hover:underline"
                    >
                      Send a code to your email instead
                    </button>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-semibold text-[#1E1B31] hover:underline"
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
                  className="text-sm font-semibold text-[#1E1B31] hover:underline"
                >
                  Use password instead
                </button>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-full bg-[#1E1B31] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#242A5F] focus:outline-none focus:ring-2 focus:ring-[#1E1B31]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="shrink-0 rounded-lg bg-[#F0EAE2] px-3 py-3 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#eef0f2] disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="w-[5.5rem] shrink-0 rounded-lg border border-transparent bg-[#F0EAE2] px-3 py-3.5 text-center text-[#1E1B31] outline-none transition focus:border-[#1E1B31]/30 focus:ring-2 focus:ring-[#1E1B31]/15"
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
                className="flex w-full items-center justify-center rounded-lg bg-[#1E1B31] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#242A5F] focus:outline-none focus:ring-2 focus:ring-[#1E1B31]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Register"}
              </button>
            </form>

            <OAuthLoginDivider variant="light" label="Or Register with" />
            <SocialLoginButtons disabled={loading} variant="light" />
          </>
        )}

        <p className="mt-8 text-center text-sm text-[#5B66A1]">
          {isSignIn ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-[#1E1B31] hover:underline"
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

        <p className="mt-4 text-center text-xs text-[#5B66A1]">
          Clinic staff?{" "}
          <Link
            href="/doctor/login"
            className="font-semibold text-[#35B9B1] hover:underline"
          >
            Doctor portal
          </Link>
        </p>
        </div>
      </motion.div>
    </div>
  );
}

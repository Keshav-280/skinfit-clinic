"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [sentHint, setSentHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function sendCode() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email first.");
      return;
    }
    setSendLoading(true);
    setSentHint(null);
    try {
      const res = await fetch("/api/auth/forgot-password/send", {
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
            : "Could not send reset code."
        );
        if (typeof data.retryAfterSeconds === "number") {
          setResendSeconds(data.retryAfterSeconds);
        }
        return;
      }
      setOtp("");
      setSentHint(
        typeof data.message === "string"
          ? data.message
          : "If an account exists, check your inbox for a reset code."
      );
      setResendSeconds(
        typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSendLoading(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Could not reset password."
        );
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setResetLoading(false);
    }
  }

  const busy = sendLoading || resetLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to sign in
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Forgot password?
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;ll email a 6-digit code so you can choose a new password.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={onReset} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setOtp("");
                setSentHint(null);
              }}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="button"
            onClick={sendCode}
            disabled={busy || resendSeconds > 0}
            className="flex w-full items-center justify-center rounded-full border border-[#1E1B31] px-5 py-3 text-base font-medium text-[#1E1B31] transition hover:bg-[#1E1B31]/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendLoading
              ? "Sending…"
              : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : "Send reset code"}
          </button>

          {sentHint ? (
            <p className="text-sm text-slate-600">{sentHint}</p>
          ) : null}

          <div>
            <label
              htmlFor="otp"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Reset code
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
              placeholder="6-digit code"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
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
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E1B31] focus:ring-2 focus:ring-[#1E1B31]/20"
                placeholder="Repeat password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                disabled={busy}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
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
            disabled={busy}
            className="flex w-full items-center justify-center rounded-full bg-[#1E1B31] px-5 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-[#5B66A1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetLoading ? "Updating…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}

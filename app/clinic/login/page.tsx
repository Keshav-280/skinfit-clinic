"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { Eye, EyeOff, Stethoscope } from "lucide-react";
import { sanitizeClinicPortalNext } from "@/src/lib/auth/clinic-portal-next";

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] px-4">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}

export default function ClinicLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <ClinicLoginForm />
    </Suspense>
  );
}

function ClinicLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/auth/doctor-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        if (!res.ok) {
          setError(
            typeof data.message === "string"
              ? data.message
              : "Could not sign in."
          );
          return;
        }
        window.location.assign(
          sanitizeClinicPortalNext(searchParams.get("next"))
        );
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, searchParams]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E1B31] shadow-lg shadow-[#1E1B31]/20">
            <Stethoscope className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 font-headline text-xl font-bold text-[#1E1B31]">
            SkinFit Wellness
          </h1>
          <p className="font-meta mt-1 text-sm uppercase tracking-wide text-[#5B66A1]">
            Clinic portal
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="clinic-email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <input
                id="clinic-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="info@skinfitwellness.in"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1E1B31] focus:bg-white focus:ring-2 focus:ring-[#1E1B31]/15"
              />
            </div>

            <div>
              <label
                htmlFor="clinic-pass"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="clinic-pass"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#1E1B31] focus:bg-white focus:ring-2 focus:ring-[#1E1B31]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#1E1B31] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#242A5F] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Eye, EyeOff, Stethoscope } from "lucide-react";

export default function DoctorLoginPage() {
  const router = useRouter();
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
          error?: string;
        };
        if (!res.ok) {
          setError(
            typeof data.message === "string"
              ? data.message
              : "Could not sign in."
          );
          return;
        }
        router.push("/doctor/patients");
        router.refresh();
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, router]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6F3] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2C3E6B] shadow-lg shadow-[#2C3E6B]/20">
            <Stethoscope className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">SkinFit Clinic</h1>
          <p className="mt-1 text-sm text-slate-500">Staff portal sign-in</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="doc-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="doc-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="doctor@clinic.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2C3E6B] focus:bg-white focus:ring-2 focus:ring-[#2C3E6B]/15"
              />
            </div>

            <div>
              <label htmlFor="doc-pass" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="doc-pass"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#2C3E6B] focus:bg-white focus:ring-2 focus:ring-[#2C3E6B]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#243356] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Eye, EyeOff, Stethoscope } from "lucide-react";

export default function DoctorSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/auth/doctor-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            secretKey: secretKey.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (!res.ok) {
          setError(
            typeof data.message === "string"
              ? data.message
              : data.error === "INVALID_SECRET_KEY"
                ? "Invalid registration secret key."
                : data.error === "EMAIL_IN_USE"
                  ? "An account with this email already exists."
                  : data.error === "SERVER_CONFIG"
                    ? "Server is not configured for staff signup. Check SESSION_SECRET and DOCTOR_REGISTRATION_SECRET_KEY."
                    : "Could not create account."
          );
          return;
        }
        // Full navigation so the new session cookie is included on the portal request.
        window.location.assign("/doctor/patients");
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [name, email, password, secretKey]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F4EB] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2C3E6B] shadow-lg shadow-[#2C3E6B]/20">
            <Stethoscope className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">SkinFit Clinic</h1>
          <p className="mt-1 text-sm text-slate-500">Create a staff account</p>
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
              <label htmlFor="doc-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Full name
              </label>
              <input
                id="doc-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2C3E6B] focus:bg-white focus:ring-2 focus:ring-[#2C3E6B]/15"
              />
            </div>

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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
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

            <div>
              <label htmlFor="doc-secret" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Registration secret key
              </label>
              <input
                id="doc-secret"
                type="password"
                autoComplete="off"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                disabled={loading}
                placeholder="Provided by clinic admin"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2C3E6B] focus:bg-white focus:ring-2 focus:ring-[#2C3E6B]/15"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#243356] disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/doctor/login" className="font-semibold text-[#2C3E6B] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

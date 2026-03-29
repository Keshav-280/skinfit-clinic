"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { DEMO_LOGIN_EMAIL } from "@/src/lib/auth/demo-login";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(DEMO_LOGIN_EMAIL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Something went wrong. Please try again."
        );
        return;
      }
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden min-h-screen flex-1 flex-col justify-center bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 px-12 lg:flex">
        <div className="mx-auto max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-white">
              SkinFit
            </span>
          </div>
          <p className="text-lg leading-relaxed text-teal-50">
            Welcome back to your personalized skincare journey.
          </p>
        </div>
      </div>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Patient Login
            </h1>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="you@gmail.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/contact"
              className="font-medium text-teal-600 hover:text-teal-700"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

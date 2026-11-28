"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT = "w-full rounded-xl border border-[#1E1B31]/15 bg-white px-4 py-3 text-base text-[#1E1B31]";

export function SkinReviewLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/skin-review/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Could not sign in.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 w-full max-w-sm space-y-4 rounded-2xl border border-[#E4E6F0] bg-white p-6">
      <h1 className="font-headline text-xl font-semibold text-[#1E1B31]">Sign in to review scans</h1>
      {!configured ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sign-in is not set up on the server yet.
        </p>
      ) : null}
      <input className={INPUT} type="email" autoComplete="username" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={INPUT} type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy || !configured} className="w-full rounded-xl bg-[#1E1B31] py-3 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

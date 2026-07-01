"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Scan,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

const PERKS = [
  { icon: Scan, label: "AI skin analysis" },
  { icon: Sparkles, label: "Personal guidance" },
  { icon: Stethoscope, label: "Clinic-connected care" },
];

export default function PreReleasePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/pre-release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), source: "pre-release" }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        if (!res.ok) {
          setError(
            typeof data.message === "string"
              ? data.message
              : "Something went wrong. Please try again."
          );
          return;
        }
        setSuccessMessage(
          typeof data.message === "string" ? data.message : null
        );
        setSubmitted(true);
      } catch {
        setError("Network error. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(44,62,107,0.12),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-white/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-1/4 h-64 w-64 rounded-full bg-[#2C3E6B]/10 blur-3xl"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12 md:py-16">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOut }}
          className="mb-10 md:mb-12"
        >
          <Image
            src="/branding/skinfit-wellness-logo.svg"
            alt="SkinFit Wellness"
            width={560}
            height={135}
            priority
            className="h-14 w-auto max-w-[min(90vw,20rem)] object-contain sm:h-16 md:h-[4.5rem] md:max-w-[24rem]"
          />
        </motion.div>

        {/* Hero copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}
          className="mb-8 max-w-lg text-center"
        >
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#3d5080]">
            Early access
          </p>
          <h1 className="text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-[#1E3264] sm:text-4xl md:text-[2.75rem]">
            Be among the{" "}
            <span className="bg-gradient-to-r from-[#2C3E6B] to-[#1E3264] bg-clip-text text-transparent">
              first
            </span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#3d5080] md:text-base">
            Register for early access to SkinFit Wellness. We&apos;ll notify you
            when the app is available.
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16, ease: easeOut }}
          className="w-full max-w-md"
        >
          <div className="overflow-hidden rounded-2xl border border-[#2C3E6B]/8 bg-white shadow-[0_24px_64px_-24px_rgba(30,50,100,0.28)]">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center px-8 py-10 text-center"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#2C3E6B] text-white shadow-md shadow-[#2C3E6B]/25">
                    <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
                  </div>
                  <h2 className="text-lg font-bold text-[#1E3264]">
                    You&apos;re registered
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#3d5080]">
                    {successMessage ??
                      `A confirmation has been sent to ${email}. We'll notify you when SkinFit Wellness is available.`}
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={(e) => void onSubmit(e)}
                  className="p-2"
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="pre-release-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="pre-release-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      disabled={loading}
                      className="min-w-0 flex-1 rounded-xl border-0 bg-[#F7F8F9] px-4 py-3.5 text-[15px] text-[#1E3264] outline-none transition placeholder:text-[#8391A1] focus:ring-2 focus:ring-[#2C3E6B]/20 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1E3264] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B] disabled:cursor-not-allowed disabled:opacity-70 sm:px-6"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Join waitlist
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </div>
                  {error ? (
                    <p
                      role="alert"
                      className="mx-2 mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {error}
                    </p>
                  ) : null}
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Perks strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: easeOut }}
          className="mt-10 flex w-full max-w-lg flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          {PERKS.map((perk) => (
            <div
              key={perk.label}
              className="flex items-center gap-2 text-sm text-[#3d5080]"
            >
              <perk.icon
                className="h-4 w-4 text-[#2C3E6B]/70"
                strokeWidth={2}
                aria-hidden
              />
              <span className="font-medium">{perk.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Store availability */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.38 }}
          className="mt-8 text-center text-xs font-medium tracking-wide text-[#8391A1]"
        >
          App Store &nbsp;·&nbsp; Google Play
        </motion.p>
      </main>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-[#8391A1]">
        <p>© {new Date().getFullYear()} SkinFit Wellness</p>
      </footer>
    </div>
  );
}

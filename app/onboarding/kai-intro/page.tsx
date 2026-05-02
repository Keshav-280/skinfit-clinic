"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Scan,
  TrendingUp,
  MessageCircle,
  Shield,
  Stethoscope,
  BadgeCheck,
} from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function KaiIntroPage() {
  return (
    <div className="relative">
      {/* soft background accents */}
      <div
        className="pointer-events-none absolute -left-20 -top-10 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-32 h-40 w-40 rounded-full bg-amber-200/25 blur-3xl"
        aria-hidden
      />

      <div className="relative space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-600/30 ring-4 ring-teal-100">
            <Sparkles className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
            Your skin companion
          </p>
          <h1 className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl">
            Meet kAI
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-zinc-600">
            kAI reads your photos across many skin parameters, spots trends when
            you stay consistent, and turns that into clear, personal guidance.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: easeOut }}
          className="rounded-3xl border border-teal-100/80 bg-white/90 p-5 shadow-[0_20px_50px_-12px_rgba(13,148,136,0.18)] backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900">What kAI does</h2>
          </div>
          <ul className="space-y-3.5">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <Scan className="h-4 w-4" />
              </span>
              <span className="text-sm leading-relaxed text-zinc-700">
                <strong className="text-zinc-900">Five-angle scoring</strong> —
                standardised photos, consistent metrics you can trust week to
                week.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <TrendingUp className="h-4 w-4" />
              </span>
              <span className="text-sm leading-relaxed text-zinc-700">
                <strong className="text-zinc-900">Trends, not one-offs</strong> —
                highlights progress when you keep up your routine and scans.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <MessageCircle className="h-4 w-4" />
              </span>
              <span className="text-sm leading-relaxed text-zinc-700">
                <strong className="text-zinc-900">Plain-language focus</strong> —
                actionable nudges; your doctor still leads your care plan.
              </span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: easeOut }}
          className="rounded-3xl border border-amber-200/60 bg-gradient-to-b from-amber-50/90 to-white p-5 shadow-[0_12px_40px_-16px_rgba(180,83,9,0.15)]"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Shield className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900">
              What kAI doesn&apos;t do
            </h2>
          </div>
          <ul className="space-y-3">
            <li className="flex gap-3 text-sm leading-relaxed text-zinc-700">
              <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/80" />
              <span>
                <strong className="text-zinc-900">No diagnosis or prescriptions</strong>{" "}
                — it doesn&apos;t replace medical judgment.
              </span>
            </li>
            <li className="flex gap-3 text-sm leading-relaxed text-zinc-700">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/80" />
              <span>
                <strong className="text-zinc-900">Not a full exam</strong> — some
                measures still need your clinician in person.
              </span>
            </li>
            <li className="flex gap-3 text-sm leading-relaxed text-zinc-700">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-[10px] font-bold text-amber-900">
                !
              </span>
              <span>
                <strong className="text-zinc-900">No guaranteed outcomes</strong> —
                your doctor sets the plan; kAI supports the journey.
              </span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: easeOut }}
        >
          <Link
            href="/onboarding/questionnaire"
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-4 text-base font-bold text-white shadow-lg shadow-teal-600/35 transition hover:from-teal-500 hover:to-teal-600 hover:shadow-xl hover:shadow-teal-600/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            <span className="relative z-10 flex items-center gap-2">
              Continue to questionnaire
              <Sparkles className="h-4 w-4 opacity-90 transition group-hover:rotate-12" />
            </span>
            <span
              className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition group-hover:opacity-100 group-hover:duration-500"
              aria-hidden
            />
          </Link>
          <p className="mt-3 text-center text-xs text-zinc-500">
            About 5–8 minutes · your answers shape your first kAI profile
          </p>
        </motion.div>
      </div>
    </div>
  );
}

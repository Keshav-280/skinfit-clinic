"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import {
  ONBOARDING_CONCERN_IDS,
  ONBOARDING_CONCERN_LABELS,
} from "@/src/lib/onboardingConcerns";
import {
  ONBOARDING_CHAT_DURATION_OPTIONS,
  ONBOARDING_CHAT_SKIN_TYPES,
  ONBOARDING_CHAT_TRIGGER_OPTIONS,
} from "@/src/lib/onboardingChatKai";
import { REFERRAL_SOURCE_OPTIONS } from "@/src/lib/onboardingReferralSource";

const easeOut = [0.22, 1, 0.36, 1] as const;

const GENDER_OPTIONS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "other", label: "Other" },
  { id: "prefer_not_say", label: "Prefer not to say" },
];

const SENSITIVITY_OPTIONS = [
  { id: "low", label: "Not really" },
  { id: "moderate", label: "Sometimes" },
  { id: "high", label: "Yes, very easily" },
];

type StepKind = "profile" | "single" | "multi";

type Option = { id: string; label: string };

type Step = {
  id: string;
  kind: StepKind;
  title: string;
  subtitle: string;
  options?: Option[];
};

const STEPS: Step[] = [
  {
    id: "profile",
    kind: "profile",
    title: "Tell us about you",
    subtitle: "Your answers help kAI personalise your skin plan.",
  },
  {
    id: "concerns",
    kind: "multi",
    title: "What's on your skin's mind?",
    subtitle: "Your answers will help shape the plan around your needs.",
    options: ONBOARDING_CONCERN_IDS.map((id) => ({
      id,
      label: ONBOARDING_CONCERN_LABELS[id],
    })),
  },
  {
    id: "duration",
    kind: "single",
    title: "How long has this been going on?",
    subtitle: "This helps us understand your timeline.",
    options: ONBOARDING_CHAT_DURATION_OPTIONS.map((o) => ({
      id: o.id,
      label: o.label,
    })),
  },
  {
    id: "triggers",
    kind: "multi",
    title: "Does anything make it worse?",
    subtitle: "Pick everything that applies.",
    options: ONBOARDING_CHAT_TRIGGER_OPTIONS.map((o) => ({
      id: o.id,
      label: o.label,
    })),
  },
  {
    id: "skinType",
    kind: "single",
    title: "What's your skin type?",
    subtitle: "Pick what feels closest.",
    options: ONBOARDING_CHAT_SKIN_TYPES.map((t) => ({ id: t, label: t })),
  },
  {
    id: "sensitivity",
    kind: "single",
    title: "Does your skin react easily?",
    subtitle: "To new products or weather changes.",
    options: SENSITIVITY_OPTIONS,
  },
  {
    id: "referral",
    kind: "single",
    title: "How did you hear about SkinFit?",
    subtitle: "Just curious!",
    options: REFERRAL_SOURCE_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
  },
];

type Answers = Record<string, string | string[] | { age: string; gender: string }>;

function Pill({
  active,
  onClick,
  children,
  index,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 + index * 0.05, ease: easeOut }}
      whileTap={{ scale: 0.98 }}
      className={`w-full rounded-2xl border px-5 py-4 text-left text-[15px] font-semibold transition-colors ${
        active
          ? "border-[#1E1B31] bg-[#1E1B31] text-white"
          : "border-[#E5E7EB] bg-white text-[#18181b] hover:border-[#1E1B31]/30"
      }`}
    >
      {children}
    </motion.button>
  );
}

function CompletionScreen({
  hasScan,
  onTakeScan,
  onGoDashboard,
}: {
  hasScan: boolean;
  onTakeScan: () => void;
  onGoDashboard: () => void;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center px-6"
      animate={{ backgroundColor: settled ? "#FAF8F5" : "#1E1B31" }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <div
        className={`flex w-full flex-1 flex-col items-center ${
          settled ? "justify-start pt-16" : "justify-center"
        }`}
      >
        {/* Tick badge - big + centered first, then shrinks and docks to top via layout animation */}
        <motion.div
          layout
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            layout: { duration: 0.6, ease: easeOut },
            scale: { type: "spring", stiffness: 260, damping: 18 },
            opacity: { duration: 0.25 },
          }}
          className={`flex items-center justify-center rounded-full bg-white shadow-xl ${
            settled ? "h-16 w-16" : "h-28 w-28"
          }`}
        >
          <svg
            width={settled ? 28 : 48}
            height={settled ? 28 : 48}
            viewBox="0 0 52 52"
            fill="none"
          >
            <motion.path
              d="M14 27l7 7 17-17"
              stroke="#1E1B31"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.35, ease: "easeOut" }}
            />
          </svg>
        </motion.div>

        {!settled ? (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55, ease: easeOut }}
            className="mt-6 text-lg font-bold text-white"
          >
            Questionnaire complete
          </motion.p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
            className="mt-6 text-center"
          >
            <h1 className="text-2xl font-extrabold text-[#18181b]">
              You&apos;re all set!
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#6B7280]">
              Thanks for sharing - kAI now has what it needs to personalise
              your care.
            </p>
          </motion.div>
        )}
      </div>

      {settled ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: easeOut }}
          className="mb-8 flex w-full max-w-md flex-col gap-3"
        >
          {!hasScan ? (
            <button
              type="button"
              onClick={onTakeScan}
              className="w-full rounded-2xl bg-[#1E1B31] py-4 text-[15px] font-bold text-white transition hover:bg-[#242A5F]"
            >
              Take your first scan
            </button>
          ) : null}
          <button
            type="button"
            onClick={onGoDashboard}
            className={
              hasScan
                ? "w-full rounded-2xl bg-[#1E1B31] py-4 text-[15px] font-bold text-white transition hover:bg-[#242A5F]"
                : "w-full rounded-2xl border border-[#1E1B31]/25 bg-white py-4 text-[15px] font-bold text-[#1E1B31] transition hover:bg-[#1E1B31]/5"
            }
          >
            Go to dashboard
          </button>
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export function QuestionnaireWizardPreview() {
  const router = useRouter();
  const [finished, setFinished] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  const canContinue = useMemo(() => {
    if (step.kind === "profile") return age.trim().length > 0 && gender.length > 0;
    const a = answers[step.id];
    if (step.kind === "multi") return Array.isArray(a) && a.length > 0;
    return typeof a === "string" && a.length > 0;
  }, [step, answers, age, gender]);

  function toggleMulti(optionId: string) {
    setAnswers((prev) => {
      const current = (prev[step.id] as string[] | undefined) ?? [];
      const next = current.includes(optionId)
        ? current.filter((x) => x !== optionId)
        : [...current, optionId];
      return { ...prev, [step.id]: next };
    });
  }

  function selectSingle(optionId: string) {
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
  }

  function goNext() {
    if (step.kind === "profile") {
      setAnswers((prev) => ({ ...prev, profile: { age, gender } }));
    }
    if (isLast) {
      setFinished(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  }

  function skip() {
    if (isLast) {
      setFinished(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  if (finished) {
    return (
      <CompletionScreen
        hasScan={false}
        onTakeScan={() => router.push("/onboarding/capture/photos")}
        onGoDashboard={() => router.push("/dashboard")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-6">
      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
        <motion.div
          className="h-full rounded-full bg-[#1E1B31]"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.45, ease: easeOut }}
        />
      </div>

      {/* Top row: back + skip */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E1B31] transition hover:bg-[#1E1B31]/8 disabled:opacity-0"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={skip}
          className="text-sm font-semibold text-[#6B7280] transition hover:text-[#1E1B31]"
        >
          Skip
        </button>
      </div>

      {/* Question content - slides left on exit, blank gap, then fades in */}
      <div className="mt-8 flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.28, ease: easeOut }}
            className="flex flex-1 flex-col"
          >
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05, ease: easeOut }}
              className="text-[26px] font-extrabold leading-tight tracking-tight text-[#18181b]"
            >
              {step.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1, ease: easeOut }}
              className="mt-2 text-sm leading-relaxed text-[#6B7280]"
            >
              {step.subtitle}
            </motion.p>

            <div className="mt-8 flex flex-col gap-2.5">
              {step.kind === "profile" ? (
                <>
                  <motion.input
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2, ease: easeOut }}
                    type="number"
                    inputMode="numeric"
                    placeholder="Your age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 text-[15px] font-semibold text-[#18181b] outline-none placeholder:text-[#9CA3AF] focus:border-[#1E1B31]/40"
                  />
                  {GENDER_OPTIONS.map((opt, i) => (
                    <Pill
                      key={opt.id}
                      index={i + 1}
                      active={gender === opt.id}
                      onClick={() => setGender(opt.id)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </>
              ) : null}

              {step.kind === "single"
                ? step.options?.map((opt, i) => (
                    <Pill
                      key={opt.id}
                      index={i}
                      active={answers[step.id] === opt.id}
                      onClick={() => selectSingle(opt.id)}
                    >
                      {opt.label}
                    </Pill>
                  ))
                : null}

              {step.kind === "multi"
                ? step.options?.map((opt, i) => (
                    <Pill
                      key={opt.id}
                      index={i}
                      active={((answers[step.id] as string[] | undefined) ?? []).includes(
                        opt.id
                      )}
                      onClick={() => toggleMulti(opt.id)}
                    >
                      {opt.label}
                    </Pill>
                  ))
                : null}
            </div>

            <p className="mt-6 text-center text-xs text-[#9CA3AF]">
              Your selections won&apos;t limit access to any features.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Continue button */}
      <motion.button
        key={`cta-${step.id}`}
        type="button"
        disabled={!canContinue}
        onClick={goNext}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.35, ease: easeOut }}
        className="mt-6 w-full rounded-2xl bg-[#1E1B31] py-4 text-center text-[15px] font-bold text-white transition disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {isLast ? "Finish" : "Continue"}
      </motion.button>
    </div>
  );
}

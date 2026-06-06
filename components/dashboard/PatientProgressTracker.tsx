"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type {
  PatientProgressSnapshot,
  ProgressMilestone,
} from "@/src/lib/patientProgressMilestones";

const NAVY = "#2C3E6B";
const GREEN = "#4CAF50";
const MUTED = "#9CA3AF";

type Props = PatientProgressSnapshot & {
  className?: string;
};

function formatUnlockList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
}

function StepCircle({
  step,
  index,
  active,
}: {
  step: ProgressMilestone;
  index: number;
  active: boolean;
}) {
  const done = step.done;
  const circle = (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold"
      style={{
        borderColor: done ? GREEN : active ? NAVY : "#E5E7EB",
        backgroundColor: done ? GREEN : active ? NAVY : "transparent",
        color: done || active ? "#fff" : MUTED,
      }}
      aria-current={active ? "step" : undefined}
    >
      {done ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      ) : (
        index + 1
      )}
    </span>
  );

  if (!step.href) return circle;

  return (
    <Link
      href={step.href}
      className="rounded-full transition hover:opacity-85"
      title={step.label}
    >
      {circle}
    </Link>
  );
}

export function PatientProgressTracker({
  milestones,
  allComplete,
  questionnaireUnlocks,
  className = "",
}: Props) {
  if (allComplete) return null;

  const activeIndex = milestones.findIndex((m) => !m.done);

  return (
    <div className={className} aria-label="Your progress">
      <div className="overflow-x-auto">
        <ol className="flex min-w-[480px] items-start">
          {milestones.map((step, index) => {
            const done = step.done;
            const active = !done && index === activeIndex;
            const isLast = index === milestones.length - 1;
            const labelClass = done
              ? "text-[#4CAF50]"
              : active
                ? "text-[#2C3E6B]"
                : "text-[#9CA3AF]";

            return (
              <li
                key={step.id}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <div className="flex w-full items-center">
                  {index > 0 ? (
                    <div
                      className="h-px flex-1"
                      style={{
                        backgroundColor: milestones[index - 1]?.done
                          ? GREEN
                          : "#E5E7EB",
                      }}
                      aria-hidden
                    />
                  ) : (
                    <span className="flex-1" aria-hidden />
                  )}
                  <div className="shrink-0 px-0.5">
                    <StepCircle step={step} index={index} active={active} />
                  </div>
                  {!isLast ? (
                    <div
                      className="h-px flex-1"
                      style={{
                        backgroundColor: done ? GREEN : "#E5E7EB",
                      }}
                      aria-hidden
                    />
                  ) : (
                    <span className="flex-1" aria-hidden />
                  )}
                </div>
                {step.href ? (
                  <Link
                    href={step.href}
                    className={`mt-1 max-w-[4.75rem] text-center text-[9px] font-semibold leading-tight hover:underline sm:text-[10px] ${labelClass}`}
                  >
                    {step.label}
                  </Link>
                ) : (
                  <p
                    className={`mt-1 max-w-[4.75rem] text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${labelClass}`}
                  >
                    {step.label}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {questionnaireUnlocks.length > 0 ? (
        <p className="mt-2 text-[10px] leading-snug text-[#6B7280] sm:text-[11px]">
          Complete questionnaire to unlock{" "}
          <span className="font-semibold text-[#2C3E6B]">
            {formatUnlockList(questionnaireUnlocks)}
          </span>
          .{" "}
          <Link
            href="/onboarding/questionnaire"
            className="font-semibold text-[#2C3E6B] underline-offset-2 hover:underline"
          >
            Continue
          </Link>
        </p>
      ) : null}
    </div>
  );
}

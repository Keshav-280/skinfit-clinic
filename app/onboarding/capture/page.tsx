import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  EyeOff,
  Smile,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";

const STEP_ICONS: Record<
  (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"],
  LucideIcon
> = {
  centre: UserRound,
  left: ArrowLeft,
  right: ArrowRight,
  eyes_closed: EyeOff,
  smiling: Smile,
};

const STEP_LABEL: Record<(typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"], string> = {
  centre: "Front",
  left: "Turn L",
  right: "Turn R",
  eyes_closed: "Eyes shut",
  smiling: "Smile",
};

export default function OnboardingCaptureIntroPage() {
  const n = FACE_SCAN_CAPTURE_STEPS.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2C3E6B] text-white shadow-lg shadow-[#2C3E6B]/25">
          <Camera className="h-7 w-7" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C3E6B]/70">
          Baseline
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#2C3E6B] md:text-3xl">
          {n} baseline photos
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7280]">
          ~2 minutes · we prompt each angle. Camera or upload — same flow as Scan.
        </p>
      </div>

      <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
          Angles in order
        </p>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {FACE_SCAN_CAPTURE_STEPS.map((s, i) => {
            const Icon = STEP_ICONS[s.id];
            return (
              <div
                key={s.id}
                className="flex flex-col items-center rounded-xl border border-white/60 bg-white/50 px-1.5 py-3 backdrop-blur-sm sm:px-2 sm:py-4"
              >
                <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2C3E6B] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <Icon
                  className="h-5 w-5 text-[#2C3E6B] sm:h-6 sm:w-6"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="mt-2 text-center text-[10px] font-semibold leading-tight text-[#374151] sm:text-xs">
                  {STEP_LABEL[s.id]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Link
        href="/onboarding/capture/photos"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080]"
      >
        <Sparkles className="h-5 w-5" aria-hidden />
        Start capture
      </Link>

      <p className="text-center text-[11px] text-[#6B7280]">
        On mobile? Same login — continue there anytime.
      </p>
    </div>
  );
}

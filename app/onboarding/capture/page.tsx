import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  EyeOff,
  Smile,
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
    <div className="relative space-y-8">
      <div
        className="pointer-events-none absolute -top-4 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-teal-400/20 blur-3xl"
        aria-hidden
      />

      <div className="relative text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-600/25">
          <Camera className="h-7 w-7 text-white" strokeWidth={2} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
          Baseline
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 md:text-3xl">
          {n} baseline photos
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-600">
          ~2 minutes · we prompt each angle. Camera or upload.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {FACE_SCAN_CAPTURE_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[s.id];
          return (
            <div
              key={s.id}
              className="flex flex-col items-center rounded-2xl border border-teal-100/80 bg-white/90 px-1.5 py-3 shadow-sm sm:px-2 sm:py-4"
            >
              <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                {i + 1}
              </span>
              <Icon className="h-5 w-5 text-teal-700 sm:h-6 sm:w-6" strokeWidth={2} />
              <span className="mt-2 text-center text-[10px] font-semibold leading-tight text-zinc-700 sm:text-xs">
                {STEP_LABEL[s.id]}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href="/onboarding/capture/photos"
        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 py-4 text-base font-bold text-white shadow-lg shadow-teal-600/30 transition hover:from-teal-500 hover:to-teal-600"
      >
        Start capture
      </Link>

      <p className="text-center text-[11px] text-zinc-400">
        On mobile? Same login — continue there anytime.
      </p>
    </div>
  );
}

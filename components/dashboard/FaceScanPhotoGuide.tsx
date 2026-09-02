"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Lock, X } from "lucide-react";
import { ScanPhotoGuideDismissCheckbox } from "@/components/dashboard/ScanPhotoGuideDismissCheckbox";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const PHOTO_GUIDE = "/images/photo-guide";

const EXAMPLE_CARDS = [
  {
    title: "Good Lighting",
    description: "Use natural light facing your face",
    good: true,
    image: `${PHOTO_GUIDE}/good-lighting.jpg`,
  },
  {
    title: "Hair Back",
    description: "Keep your hair off your face",
    good: true,
    image: `${PHOTO_GUIDE}/hair-back.jpg`,
  },
  {
    title: "No Accessories",
    description: "Remove glasses, earrings, caps",
    good: true,
    image: `${PHOTO_GUIDE}/no-accessories.jpg`,
  },
  {
    title: "Avoid Sunglasses",
    description: "Don't wear sunglasses or tinted glasses",
    good: false,
    image: `${PHOTO_GUIDE}/avoid-sunglasses.jpg`,
  },
  {
    title: "Avoid Dark Lighting",
    description: "Don't stand in dark or backlight",
    good: false,
    image: `${PHOTO_GUIDE}/avoid-dark-lighting.jpg`,
  },
] as const;

const GOOD_POINTS = [
  "Clear and bright",
  "Face in frame",
  "Neutral background",
  "Look at the camera",
] as const;

const AVOID_POINTS = [
  "Blurry or low quality",
  "Face not visible",
  "Busy background",
  "Extreme angles",
] as const;

export type PhotoGuideMode = "camera" | "review";

type Props = {
  mode?: PhotoGuideMode;
  dontRemind: boolean;
  onDontRemindChange: (checked: boolean) => void;
  onContinue: () => void;
  onBack?: () => void;
  showDismissOption?: boolean;
};

function StatusMark({ good }: { good: boolean }) {
  return (
    <span
      className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
        good ? "bg-[#4CAF50] text-white" : "bg-[#EF4444] text-white"
      }`}
    >
      {good ? (
        <Check className="h-4 w-4 stroke-[3]" aria-hidden />
      ) : (
        <X className="h-4 w-4 stroke-[3]" aria-hidden />
      )}
    </span>
  );
}

function GuideFooter({
  continueLabel,
  dontRemind,
  onDontRemindChange,
  onContinue,
  onBack,
  showDismissOption = true,
}: {
  continueLabel: string;
  dontRemind: boolean;
  onDontRemindChange: (checked: boolean) => void;
  onContinue: () => void;
  onBack?: () => void;
  showDismissOption?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showDismissOption ? (
        <ScanPhotoGuideDismissCheckbox checked={dontRemind} onChange={onDontRemindChange} />
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="order-2 rounded-2xl border border-[#1E1B31]/20 bg-white/30 px-6 py-3 text-sm font-semibold text-[#1E1B31] transition hover:bg-white/50 sm:order-1"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={onContinue}
          className={`rounded-2xl px-8 py-3.5 text-base font-bold text-white shadow-[0_8px_24px_-6px_rgba(30,50,100,0.35)] transition hover:opacity-[0.96] active:scale-[0.99] ${
            onBack ? "order-1 sm:order-2" : "w-full sm:min-w-[220px]"
          }`}
          style={{ backgroundColor: NAVY_DARK }}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}

export function FaceScanPhotoGuide({
  mode = "camera",
  dontRemind,
  onDontRemindChange,
  onContinue,
  onBack,
  showDismissOption = true,
}: Props) {
  const continueLabel = mode === "review" ? "Got it" : "Start Scan";

  return (
    <div className="relative mx-auto w-full max-w-6xl px-1 py-2" aria-label="Photo capture guide">
      <div className="mb-5 lg:mb-6">
        <h1
          className="font-headline text-[1.85rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2rem]"
          style={{ color: NAVY }}
        >
          Photo guide
        </h1>
        <p className="mt-1 text-base text-[#4A5568] lg:text-lg">
          Follow these simple tips for accurate results
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 xl:gap-4">
        {EXAMPLE_CARDS.map((card) => (
          <article
            key={card.title}
            className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/45 bg-white/55 shadow-[0_4px_20px_-12px_rgba(30,27,49,0.25)] backdrop-blur-[2px]"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#DCCFC0]/80">
              <Image
                src={card.image}
                alt={card.title}
                fill
                className="object-cover object-top"
                sizes="(min-width: 1024px) 180px, 45vw"
              />
              <StatusMark good={card.good} />
            </div>
            <div className="flex flex-1 flex-col px-3 py-3">
              <h3 className="text-sm font-extrabold" style={{ color: NAVY }}>
                {card.title}
              </h3>
              <p className="mt-1 text-xs leading-snug text-[#64748B]">{card.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <section className="flex overflow-hidden rounded-2xl border border-[#4CAF50]/20 bg-white/40">
          <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#4CAF50]">Good</p>
            <ul className="mt-3 space-y-2">
              {GOOD_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm font-medium text-[#1F2A44]">
                  <Check className="h-4 w-4 shrink-0 text-[#4CAF50]" strokeWidth={3} aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative w-[38%] min-w-[104px] shrink-0 sm:w-[42%] sm:min-w-[120px]">
            <Image
              src={`${PHOTO_GUIDE}/summary-good.jpg`}
              alt="Example of a good capture"
              fill
              className="object-cover object-top"
              sizes="160px"
            />
            <StatusMark good />
          </div>
        </section>

        <section className="flex overflow-hidden rounded-2xl border border-[#EF4444]/15 bg-white/35">
          <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#EF4444]">Avoid</p>
            <ul className="mt-3 space-y-2">
              {AVOID_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm font-medium text-[#1F2A44]">
                  <X className="h-4 w-4 shrink-0 text-[#EF4444]" strokeWidth={3} aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative w-[38%] min-w-[104px] shrink-0 sm:w-[42%] sm:min-w-[120px]">
            <Image
              src={`${PHOTO_GUIDE}/summary-avoid.jpg`}
              alt="Example of a capture to avoid"
              fill
              className="object-cover object-top"
              sizes="160px"
            />
            <StatusMark good={false} />
          </div>
        </section>
      </div>

      <div className="mt-6 space-y-5 pb-2 lg:mt-8">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[#4A5568] lg:hidden">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Your photos are secure and private.{" "}
            <Link href="/privacy" className="font-semibold underline underline-offset-2" style={{ color: NAVY }}>
              Read our Privacy Policy.
            </Link>
          </span>
        </p>
        <GuideFooter
          continueLabel={continueLabel}
          dontRemind={dontRemind}
          onDontRemindChange={onDontRemindChange}
          onContinue={onContinue}
          onBack={onBack}
          showDismissOption={showDismissOption}
        />
      </div>
    </div>
  );
}

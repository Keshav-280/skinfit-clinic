"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Check,
  CircleUserRound,
  Glasses,
  ImageIcon,
  Lock,
  ScanFace,
  Sun,
  X,
} from "lucide-react";
import { ScanPhotoGuideDismissCheckbox } from "@/components/dashboard/ScanPhotoGuideDismissCheckbox";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const PHOTO_GUIDE = "/images/photo-guide";

const MOBILE_TIPS = [
  { icon: Sun, label: "Good natural lighting" },
  { icon: Glasses, label: "Remove glasses and accessories" },
  { icon: ScanFace, label: "Tie your hair back" },
  { icon: CircleUserRound, label: "No makeup or heavy filters" },
  { icon: ImageIcon, label: "Use a plain background" },
] as const;

const DESKTOP_CARDS = [
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
};

function GuideFooter({
  continueLabel,
  dontRemind,
  onDontRemindChange,
  onContinue,
  onBack,
}: {
  continueLabel: string;
  dontRemind: boolean;
  onDontRemindChange: (checked: boolean) => void;
  onContinue: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <ScanPhotoGuideDismissCheckbox checked={dontRemind} onChange={onDontRemindChange} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="order-2 rounded-2xl border border-[#2C3E6B]/20 bg-white/30 px-6 py-3 text-sm font-semibold text-[#2C3E6B] transition hover:bg-white/50 sm:order-1"
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
}: Props) {
  const mobileContinueLabel = mode === "review" ? "Got it" : "Start Scan";
  const desktopContinueLabel = mode === "review" ? "Got it" : "Continue";

  return (
    <div className="relative w-full" aria-label="Photo capture guide">
      {/* Mobile */}
      <div className="flex flex-col justify-between gap-10 px-1 py-2 pb-4 lg:hidden">
        <div>
          <h1
            className="text-[2rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2.25rem]"
            style={{ color: NAVY }}
          >
            Let&apos;s capture
            <br />
            your best profile
          </h1>
          <p className="mt-3 max-w-xs text-base leading-relaxed text-[#4A5568]">
            We&apos;ll take 5 quick photos to create your personalized analysis.
          </p>

          <ul className="mt-8 space-y-4">
            {MOBILE_TIPS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/40">
                  <Icon className="h-5 w-5" style={{ color: NAVY }} aria-hidden />
                </span>
                <span className="text-[17px] font-semibold leading-snug" style={{ color: NAVY }}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-[#4A5568]">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Your photos are secure and private.{" "}
              <Link href="/privacy" className="font-semibold underline underline-offset-2" style={{ color: NAVY }}>
                Read our Privacy Policy.
              </Link>
            </span>
          </p>
          <GuideFooter
            continueLabel={mobileContinueLabel}
            dontRemind={dontRemind}
            onDontRemindChange={onDontRemindChange}
            onContinue={onContinue}
            onBack={onBack}
          />
        </div>
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden max-w-6xl flex-col py-2 lg:flex">
        <div className="mb-6">
          <h2 className="text-[2rem] font-extrabold tracking-tight" style={{ color: NAVY }}>
            PHOTO GUIDE
          </h2>
          <p className="mt-1 text-lg text-[#4A5568]">
            Follow these simple tips for accurate results
          </p>
        </div>

        <div className="grid grid-cols-5 gap-3 xl:gap-4">
          {DESKTOP_CARDS.map((card) => (
            <article
              key={card.title}
              className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/45 bg-white/55 shadow-[0_4px_20px_-12px_rgba(44,62,107,0.25)] backdrop-blur-[2px]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#D6E4D0]/80">
                <Image
                  src={card.image}
                  alt=""
                  fill
                  className="object-cover object-top"
                  sizes="(min-width: 1024px) 180px, 20vw"
                />
                <span
                  className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
                    card.good ? "bg-[#4CAF50] text-white" : "bg-[#EF4444] text-white"
                  }`}
                >
                  {card.good ? (
                    <Check className="h-4 w-4 stroke-[3]" aria-hidden />
                  ) : (
                    <X className="h-4 w-4 stroke-[3]" aria-hidden />
                  )}
                </span>
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

        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="flex overflow-hidden rounded-2xl border border-[#4CAF50]/20 bg-white/40">
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-5">
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
            <div className="relative w-[42%] min-w-[120px] shrink-0">
              <Image
                src={`${PHOTO_GUIDE}/summary-good.jpg`}
                alt=""
                fill
                className="object-cover object-top"
                sizes="200px"
              />
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#4CAF50] text-white shadow-sm">
                <Check className="h-4 w-4 stroke-[3]" aria-hidden />
              </span>
            </div>
          </section>

          <section className="flex overflow-hidden rounded-2xl border border-[#EF4444]/15 bg-white/35">
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-5">
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
            <div className="relative w-[42%] min-w-[120px] shrink-0">
              <Image
                src={`${PHOTO_GUIDE}/summary-avoid.jpg`}
                alt=""
                fill
                className="object-cover object-top"
                sizes="200px"
              />
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-sm">
                <X className="h-4 w-4 stroke-[3]" aria-hidden />
              </span>
            </div>
          </section>
        </div>

        <div className="mt-8 pb-2">
          <GuideFooter
            continueLabel={desktopContinueLabel}
            dontRemind={dontRemind}
            onDontRemindChange={onDontRemindChange}
            onContinue={onContinue}
            onBack={onBack}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Cormorant_Garamond } from "next/font/google";
import type { ReportMetrics, ReportRegion } from "./scanReportTypes";

export type { ReportMetrics, ReportRegion } from "./scanReportTypes";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const BEIGE = "#F5F1E9";
const TEAL_BAND = "#E0EEEB";
const PEACH = "#F29C91";
const BTN = "#6D8C8E";

const LOREM_PROFILE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

const CAUSES_P1 =
  "Environmental factors such as UV exposure, seasonal dryness, and urban pollution can accentuate texture irregularities and uneven tone. A consistent barrier-focused routine helps mitigate these stressors.";
const CAUSES_P2 =
  "Hormonal shifts, stress, and sleep patterns may also influence oil balance and sensitivity. Tracking flare-ups alongside lifestyle changes gives clearer insight into your skin’s triggers.";

const OVERVIEW_P2 =
  "Maintaining gentle cleansing, daily photoprotection, and targeted hydration supports long-term barrier health and helps preserve the improvements shown in your latest scan.";

const easeOut = [0.22, 1, 0.36, 1] as const;

function clamp(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function Donut({
  percent,
  size,
  stroke,
  color,
  track = "rgba(0,0,0,0.08)",
  gradientId,
}: {
  percent: number;
  size: number;
  stroke: number;
  color: string;
  track?: string;
  gradientId?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp(percent) / 100);
  const strokeColor = gradientId ? `url(#${gradientId})` : color;
  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      aria-hidden
    >
      {gradientId && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.82} />
          </linearGradient>
        </defs>
      )}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </svg>
  );
}

const TREATMENT_IMAGES = [
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=280&h=400&fit=crop&q=85",
  "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=280&h=400&fit=crop&q=85",
  "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=280&h=400&fit=crop&q=85",
  "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=280&h=400&fit=crop&q=85",
];

export interface SkinScanReportBodyProps {
  userName: string;
  age?: number;
  skinType?: string;
  imageUrl: string;
  regions: ReportRegion[];
  metrics: ReportMetrics;
  aiSummary?: string;
  scanDate: Date;
  /** Renders the close control (e.g. in the post-scan modal). */
  onClose?: () => void;
  className?: string;
}

export function SkinScanReportBody({
  userName,
  age = 18,
  skinType = "Dry",
  imageUrl,
  regions,
  metrics,
  aiSummary,
  scanDate,
  onClose,
  className = "",
}: SkinScanReportBodyProps) {
  const overall = clamp(metrics.overall_score);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: easeOut }}
      className={`relative w-full max-w-3xl overflow-hidden rounded-[22px] border border-white/60 ${className}`}
      style={{
        backgroundColor: BEIGE,
        boxShadow: `
            0 0 0 1px rgba(255,255,255,0.65) inset,
            0 32px 64px -12px rgba(0,0,0,0.14),
            0 12px 24px -8px rgba(0,0,0,0.08)
          `,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/35 to-transparent"
        aria-hidden
      />

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/75 text-zinc-500 shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:border-white hover:bg-white hover:text-zinc-900 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] active:scale-[0.97]"
          aria-label="Close"
        >
          <X className="h-[15px] w-[15px] stroke-[1.75]" />
        </button>
      ) : null}

      <div className="relative px-5 pb-28 pt-9 sm:px-9 sm:pb-32">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.4, ease: easeOut }}
            className="max-w-md pr-0 lg:pr-5"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500/90">
              Skin analysis report
            </p>
            <h2
              id="scan-report-title"
              className={`${serif.className} mt-2 text-[2rem] font-medium leading-[1.15] tracking-[-0.02em] text-zinc-900 sm:text-[2.35rem]`}
            >
              Hello {userName}
            </h2>
            <p className="mt-4 text-[13px] font-medium tracking-wide text-zinc-600">
              Age: {age}yrs
              <span className="mx-2.5 inline-block h-0.5 w-0.5 rounded-full bg-zinc-400 align-middle" />
              Skin type: {skinType}
            </p>
            <p className="mt-5 text-[14px] leading-[1.7] text-zinc-600/95">
              {LOREM_PROFILE}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.45, ease: easeOut }}
            className="relative mx-auto flex w-full max-w-[220px] justify-center sm:max-w-[260px]"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-zinc-200 ring-1 ring-black/[0.06] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18),0_8px_16px_-6px_rgba(0,0,0,0.08)]">
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/[0.06] via-transparent to-white/10"
                aria-hidden
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Your scan"
                className="h-full w-full object-cover"
              />
              {regions.map((region, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.3 + i * 0.05,
                    duration: 0.35,
                    ease: easeOut,
                  }}
                  className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]"
                  style={{
                    left: `${region.coordinates.x}%`,
                    top: `${region.coordinates.y}%`,
                  }}
                  title={region.issue}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.4, ease: easeOut }}
            className="flex flex-col gap-6 lg:items-end lg:pl-2"
          >
            {[
              {
                label: "Acne",
                value: metrics.acne,
                fill: "#5B8FD8",
                track: "rgba(91, 143, 216, 0.18)",
              },
              {
                label: "Hydration",
                value: metrics.hydration,
                fill: PEACH,
                track: "rgba(242, 156, 145, 0.22)",
              },
              {
                label: "Wrinkles",
                value: metrics.wrinkles,
                fill: "#9EC5E8",
                track: "rgba(158, 197, 232, 0.3)",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex w-full max-w-[210px] items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/35 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-[2px] lg:w-[210px]"
              >
                <span className="text-[13px] font-semibold tracking-tight text-zinc-700">
                  {row.label}
                </span>
                <div className="flex items-center gap-2.5">
                  <Donut
                    percent={row.value}
                    size={54}
                    stroke={5}
                    color={row.fill}
                    track={row.track}
                  />
                  <span className="w-11 text-right text-[13px] font-semibold tabular-nums tracking-tight text-zinc-800">
                    {clamp(row.value)}%
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45, ease: easeOut }}
          className="absolute bottom-0 left-1/2 z-10 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 translate-y-1/2 rounded-[20px] border border-white/80 bg-white/95 px-5 py-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12),0_8px_16px_-4px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:px-9 sm:py-7"
        >
          <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Your Skin Health
              </p>
              <p
                className={`${serif.className} mt-1 text-[2.75rem] font-medium leading-none tracking-[-0.03em] sm:text-[3.25rem]`}
                style={{ color: PEACH }}
              >
                {overall}%
              </p>
              <p className="mt-2 text-[12px] font-medium text-zinc-500">
                Last scan: {lastScanLabel}
              </p>
            </div>
            <div
              className="hidden h-[4.5rem] w-px shrink-0 bg-gradient-to-b from-transparent via-zinc-200 to-transparent sm:block"
              aria-hidden
            />
            <div className="flex flex-1 justify-center sm:justify-end">
              <div className="rounded-full p-1 shadow-[0_4px_14px_rgba(242,156,145,0.25)] ring-1 ring-black/[0.04]">
                <Donut
                  percent={overall}
                  size={104}
                  stroke={9}
                  color={PEACH}
                  track="#F0E4E1"
                  gradientId="donut-peach-main"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div
        className="relative mt-16 border-t border-white/40 px-5 py-12 sm:px-9 sm:py-14"
        style={{
          background: `linear-gradient(180deg, ${TEAL_BAND} 0%, #d8ebe6 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
          aria-hidden
        />
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
          <div className="relative md:pr-10 md:after:absolute md:after:right-0 md:after:top-0 md:after:h-full md:after:w-px md:after:bg-gradient-to-b md:after:from-zinc-400/25 md:after:via-zinc-400/40 md:after:to-zinc-400/25">
            <div className="mb-4 h-px w-8 rounded-full bg-zinc-800/25" aria-hidden />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-800">
              Overview
            </h3>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700/95">
              {aiSummary?.trim() ||
                "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early."}
            </p>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700/95">
              {OVERVIEW_P2}
            </p>
          </div>
          <div>
            <div className="mb-4 h-px w-8 rounded-full bg-zinc-800/25" aria-hidden />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-800">
              Causes/Challenges
            </h3>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700/95">
              {CAUSES_P1}
            </p>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700/95">
              {CAUSES_P2}
            </p>
          </div>
        </div>
      </div>

      <div
        className="relative px-5 pb-12 pt-14 sm:px-9"
        style={{ backgroundColor: BEIGE }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent"
          aria-hidden
        />
        <h3 className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-800">
          Treatment videos
        </h3>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {TREATMENT_IMAGES.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: easeOut }}
              className="group relative aspect-[3/5] overflow-hidden rounded-[14px] bg-zinc-200 ring-1 ring-black/[0.05] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.15)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.08] to-transparent opacity-0 transition group-hover:opacity-100"
                aria-hidden
              />
            </motion.div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
            To know your skin better
          </p>
          <Link
            href="/contact"
            className="rounded-[14px] px-12 py-3.5 text-[13px] font-semibold tracking-wide text-white shadow-[0_4px_14px_rgba(109,140,142,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(109,140,142,0.4)] active:translate-y-0 active:scale-[0.98]"
            style={{ backgroundColor: BTN }}
          >
            Book now
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

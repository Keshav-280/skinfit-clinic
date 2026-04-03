"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Mail, Share2, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Cormorant_Garamond } from "next/font/google";
import type { ReportMetrics, ReportRegion } from "./scanReportTypes";
import {
  downloadScanReportPdf,
  renderScanReportPdfBlob,
} from "@/src/lib/downloadScanReportPdf";

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

function shortenUrl(url: string, maxLen = 38) {
  const s = url.trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

export interface SkinScanReportBodyProps {
  userName: string;
  age?: number;
  skinType?: string;
  imageUrl: string;
  regions: ReportRegion[];
  metrics: ReportMetrics;
  aiSummary?: string;
  scanDate: Date;
  autoDownload?: boolean;
  autoCloseAfterDownload?: boolean;
  /** Renders the close control (e.g. in the post-scan modal). */
  onClose?: () => void;
  className?: string;
  /** Saved scan id (history page). Enables “Share → email” when set. */
  scanId?: number;
  /** Pre-fill share recipient (e.g. patient’s account email). */
  defaultShareEmail?: string | null;
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
  autoDownload = false,
  autoCloseAfterDownload = false,
  onClose,
  className = "",
  scanId,
  defaultShareEmail = null,
}: SkinScanReportBodyProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState(() => defaultShareEmail?.trim() ?? "");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareDone, setShareDone] = useState(false);
  const overall = clamp(metrics.overall_score);
  const lastScanLabel = formatDistanceToNow(scanDate, { addSuffix: true });

  const handleDownloadPdf = useCallback(async () => {
    const el = reportRef.current;
    if (!el) return;
    setPdfError(null);
    setPdfLoading(true);
    let success = false;
    try {
      // Ensure any in-flight animations/styles are applied before rendering to canvas.
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve())
        )
      );
      // When autoDownloading, many sections are still animating in (Framer Motion).
      // Give a small buffer so the patient image + sections are visible in the capture.
      if (autoDownload) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 850));
      }
      await downloadScanReportPdf(
        el,
        `ai-scan-report-${format(scanDate, "yyyy-MM-dd-HHmm")}.pdf`
      );
      success = true;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : `PDF download failed: ${JSON.stringify(e)}`;
      setPdfError(msg);
      console.error(e);
    } finally {
      setPdfLoading(false);
      // Only close after a confirmed successful generation.
      if (
        autoCloseAfterDownload &&
        success &&
        typeof window !== "undefined" &&
        window.opener
      ) {
        // Allow the browser a bit longer so the download isn't interrupted.
        window.setTimeout(() => window.close(), 2000);
      }
    }
  }, [scanDate, autoCloseAfterDownload, autoDownload]);

  useEffect(() => {
    const d = defaultShareEmail?.trim();
    if (d) setShareEmail(d);
  }, [defaultShareEmail]);

  const handleShareByEmail = useCallback(async () => {
    if (!scanId || scanId < 1) return;
    const el = reportRef.current;
    if (!el) return;
    const trimmed = shareEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setShareError("Enter a valid email address.");
      return;
    }
    setShareError(null);
    setShareDone(false);
    setShareBusy(true);
    try {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve())
        )
      );
      const blob = await renderScanReportPdfBlob(el);
      const filename = `ai-scan-report-${format(scanDate, "yyyy-MM-dd-HHmm")}.pdf`;
      const fd = new FormData();
      fd.set("toEmail", trimmed);
      fd.set("file", blob, filename);
      fd.set("filename", filename);
      const res = await fetch(`/api/scans/${scanId}/share-email`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 503 && data.error === "EMAIL_NOT_CONFIGURED") {
          throw new Error("Email is not configured on this server.");
        }
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not send email."
        );
      }
      setShareDone(true);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setShareBusy(false);
    }
  }, [scanId, shareEmail, scanDate]);

  const didAutoDownloadRef = useRef(false);
  useEffect(() => {
    if (!autoDownload) return;
    if (didAutoDownloadRef.current) return;
    didAutoDownloadRef.current = true;
    // Start quickly; PDF generation already waits for images to load.
    // We avoid long delays to reduce browser auto-download blocking.
    const t = window.requestAnimationFrame(() => {
      void handleDownloadPdf();
    });
    return () => window.cancelAnimationFrame(t);
  }, [autoDownload, handleDownloadPdf]);

  const faceImgCrossOrigin =
    imageUrl.startsWith("http://") || imageUrl.startsWith("https://")
      ? ("anonymous" as const)
      : undefined;

  return (
    <div className={`relative w-full max-w-3xl ${className}`}>
      <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="flex h-10 items-center gap-1.5 rounded-full border border-white bg-white px-3 text-xs font-semibold text-zinc-600 shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-white hover:text-zinc-900 disabled:opacity-60"
          title="Download report as PDF"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {pdfLoading ? "…" : "PDF"}
        </button>
        {typeof scanId === "number" && scanId > 0 ? (
          <button
            type="button"
            onClick={() => {
              setShareOpen((o) => !o);
              setShareError(null);
              setShareDone(false);
            }}
            className={`flex h-10 items-center gap-1.5 rounded-full border border-white bg-white px-3 text-xs font-semibold shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:bg-white disabled:opacity-60 ${
              shareOpen ? "text-teal-800 ring-2 ring-teal-200/80" : "text-zinc-600 hover:text-zinc-900"
            }`}
            title="Share report"
            aria-expanded={shareOpen}
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden />
            Share
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-white text-zinc-500 shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md transition hover:border-white hover:bg-white hover:text-zinc-900 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] active:scale-[0.97]"
            aria-label="Close"
          >
            <X className="h-[15px] w-[15px] stroke-[1.75]" />
          </button>
        ) : null}
        </div>
        {shareOpen && typeof scanId === "number" && scanId > 0 ? (
          <div className="w-[min(100vw-2rem,20rem)] rounded-2xl border border-zinc-200/90 bg-white/95 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Share report
            </p>
            <div className="mt-2 flex items-center gap-2 text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-[10px] font-medium uppercase tracking-wide">
                Email
              </span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-zinc-500">
              Sends the same PDF as download via email (works with Gmail and
              other providers).
            </p>
            <label className="mt-2 block text-[11px] font-medium text-zinc-600">
              To
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
                autoComplete="email"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleShareByEmail()}
              disabled={shareBusy || pdfLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: BTN }}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {shareBusy ? "Sending…" : "Send by email"}
            </button>
            {shareError ? (
              <p className="mt-2 text-[11px] text-rose-600">{shareError}</p>
            ) : null}
            {shareDone ? (
              <p className="mt-2 text-[11px] font-medium text-teal-800">
                Sent. Check the inbox (and spam).
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {pdfError ? (
        <div className="pointer-events-none absolute right-3 top-16 z-40 max-w-[280px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow-sm">
          {pdfError}
        </div>
      ) : null}

    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: easeOut }}
      className="relative w-full overflow-hidden rounded-[22px] border border-white"
      style={{
        backgroundColor: BEIGE,
        boxShadow: `
            0 0 0 1px rgba(255,255,255,0.65) inset,
            0 32px 64px -12px rgba(0,0,0,0.14),
            0 12px 24px -8px rgba(0,0,0,0.08)
          `,
      }}
    >
      {/* PDF / email: hero + Overview/Causes only (see data-pdf-section). Treatment videos & Book stay on-screen only. */}
      <div ref={reportRef} className="relative w-full">
      <div data-pdf-section className="relative w-full">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white to-transparent"
        aria-hidden
      />

      <div className="relative px-5 pb-16 pt-9 sm:px-9 sm:pb-20">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.4, ease: easeOut }}
            className="max-w-md pr-0 lg:pr-5"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              AI scan report
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
            <p className="mt-5 text-[14px] leading-[1.7] text-zinc-600">
              {LOREM_PROFILE}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.45, ease: easeOut }}
            className="relative mx-auto flex w-full max-w-[220px] justify-center sm:max-w-[260px]"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-zinc-200 ring-1 ring-[rgba(0,0,0,0.18)] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18),0_8px_16px_-6px_rgba(0,0,0,0.08)]">
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black via-transparent to-white"
                aria-hidden
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Your scan"
                className="h-full w-full object-cover"
                crossOrigin={faceImgCrossOrigin}
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
                  className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]"
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
                className="flex w-full max-w-[210px] items-center justify-between gap-3 rounded-2xl border border-white bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-[2px] lg:w-[210px]"
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
      </div>
      </div>

      {/* Own PDF section so html2canvas slices never cut through the score card (short single capture). */}
      <div
        data-pdf-section
        className="relative z-10 -mt-[4.5rem] flex w-full justify-center px-5 sm:-mt-24 sm:px-9"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45, ease: easeOut }}
          className="w-[calc(100%-0.5rem)] max-w-lg rounded-[20px] border border-white bg-white px-5 py-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12),0_8px_16px_-4px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:px-9 sm:py-7"
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
              <div className="rounded-full p-1 shadow-[0_4px_14px_rgba(242,156,145,0.25)] ring-1 ring-[rgba(0,0,0,0.18)]">
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
        data-pdf-section
        className="relative mt-16 border-t border-white px-5 py-12 sm:px-9 sm:py-14"
        style={{
          background: `linear-gradient(180deg, ${TEAL_BAND} 0%, #d8ebe6 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          aria-hidden
        />
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
          <div className="relative md:pr-10 md:after:absolute md:after:right-0 md:after:top-0 md:after:h-full md:after:w-px md:after:bg-gradient-to-b md:after:from-zinc-400 md:after:via-zinc-400 md:after:to-zinc-400">
            <div className="mb-4 h-px w-8 rounded-full bg-zinc-800" aria-hidden />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-800">
              Overview
            </h3>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700">
              {aiSummary?.trim() ||
                "Your skin shows a balanced profile with room to optimize hydration and maintain clarity. Continue tracking changes after each scan to spot trends early."}
            </p>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700">
              {OVERVIEW_P2}
            </p>
          </div>
          <div>
            <div className="mb-4 h-px w-8 rounded-full bg-zinc-800" aria-hidden />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-800">
              Causes/Challenges
            </h3>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700">
              {CAUSES_P1}
            </p>
            <p className="mt-5 text-[14px] leading-[1.75] text-zinc-700">
              {CAUSES_P2}
            </p>
          </div>
        </div>
      </div>
      </div>

      <div
        className="relative px-5 pb-10 pt-14 sm:px-9"
        style={{ backgroundColor: BEIGE }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black to-transparent"
          aria-hidden
        />
        <h3 className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-800">
          Treatment videos
        </h3>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {TREATMENT_IMAGES.map((src, i) => {
            if (autoDownload) {
              // In the PDF we don't want to rely on remote image loading.
              return (
                <div
                  key={i}
                  className="rounded-[14px] border border-white bg-white/60 px-3 py-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Video {i + 1}
                  </p>
                  <p
                    className="mt-2 break-all text-[11px] font-medium text-zinc-700"
                    title={src}
                  >
                    {shortenUrl(src)}
                  </p>
                </div>
              );
            }

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: easeOut }}
                className="group relative aspect-[3/5] overflow-hidden rounded-[14px] bg-zinc-200 ring-1 ring-[rgba(0,0,0,0,0.18)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.15)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  crossOrigin="anonymous"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 transition group-hover:opacity-100"
                  aria-hidden
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <div
        className="relative px-5 pb-12 pt-2 sm:px-9"
        style={{ backgroundColor: BEIGE }}
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
            To know your skin better
          </p>
          <Link
            href="/dashboard/schedules?calendar=doctor#schedules-doctor-calendar"
            className="rounded-[14px] px-12 py-3.5 text-[13px] font-semibold tracking-wide text-white shadow-[0_4px_14px_rgba(109,140,142,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(109,140,142,0.4)] active:translate-y-0 active:scale-[0.98]"
            style={{ backgroundColor: BTN }}
          >
            Book now
          </Link>
        </div>
      </div>
    </motion.div>
    </div>
  );
}

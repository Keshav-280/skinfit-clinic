"use client";

import { SCAN_CAPTURE_EXTRA_TIPS } from "@/src/lib/scanCaptureExtraTips";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const ACCENT = "#E07088";

export function ScanCaptureExtraTipsPanel({
  compact = false,
  dense = false,
}: {
  compact?: boolean;
  dense?: boolean;
}) {
  if (dense) {
    return (
      <section
        className="rounded-lg border border-[#2C3E6B]/10 bg-white/80 p-3 sm:rounded-xl sm:p-4"
        aria-label="Extra capture tips"
      >
        <h3 className="text-[10px] font-extrabold uppercase tracking-wide sm:text-[11px]" style={{ color: NAVY }}>
          Extra tips
        </h3>
        <ul className="mt-3 space-y-5 sm:space-y-6">
          {SCAN_CAPTURE_EXTRA_TIPS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-2.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full sm:h-6 sm:w-6"
                style={{ backgroundColor: "rgba(224, 112, 136, 0.14)" }}
              >
                <Icon className="h-3 w-3" style={{ color: ACCENT }} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold leading-tight sm:text-[10px]" style={{ color: NAVY }}>
                  {title}
                </p>
                <p className="line-clamp-2 text-[8px] leading-snug text-[#6B7280] sm:text-[9px]">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-[#2C3E6B]/10 bg-white/80 shadow-[0_4px_24px_-14px_rgba(44,62,107,0.2)] backdrop-blur-sm ${
        compact ? "p-3" : "p-5"
      }`}
      aria-label="Extra capture tips"
    >
      <h3
        className={`font-extrabold uppercase tracking-[0.12em] ${compact ? "text-[11px]" : "text-sm"}`}
        style={{ color: NAVY }}
      >
        Extra tips
      </h3>
      <ul className={compact ? "mt-2 space-y-2" : "mt-4 space-y-4"}>
        {SCAN_CAPTURE_EXTRA_TIPS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-2">
            <span
              className={`flex shrink-0 items-center justify-center rounded-full ${
                compact ? "h-7 w-7" : "h-10 w-10"
              }`}
              style={{ backgroundColor: "rgba(224, 112, 136, 0.14)" }}
            >
              <Icon
                className={compact ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"}
                style={{ color: ACCENT }}
                aria-hidden
              />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`font-bold ${compact ? "text-xs" : "text-sm"}`} style={{ color: NAVY }}>
                {title}
              </p>
              <p
                className={`leading-snug text-[#6B7280] ${compact ? "text-[11px]" : "mt-0.5 text-sm"}`}
              >
                {description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

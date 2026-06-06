"use client";

import type { ReactNode } from "react";
import { WHY_WE_NEED_SCAN_PHOTOS } from "@/src/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const CARD_BG = "#F6F5F2";
const LINE = "#7A94B8";
const DOT = NAVY;

function FaceDiagram() {
  return (
    <svg viewBox="0 0 200 240" className="mx-auto h-[200px] w-[168px] sm:h-[220px] sm:w-[184px]" aria-hidden>
      <ellipse cx="100" cy="88" rx="46" ry="56" fill="none" stroke={LINE} strokeWidth="1.6" />
      <path
        d="M 68 132 C 62 152 58 172 54 192 M 132 132 C 138 152 142 172 146 192"
        fill="none"
        stroke={LINE}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M 54 192 C 72 204 86 208 100 208 C 114 208 128 204 146 192"
        fill="none"
        stroke={LINE}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line x1="100" y1="36" x2="100" y2="208" stroke={LINE} strokeWidth="1.2" strokeDasharray="4 4" />

      <line x1="18" y1="58" x2="54" y2="78" stroke={LINE} strokeWidth="1" />
      <circle cx="54" cy="78" r="3" fill={DOT} />
      <line x1="18" y1="58" x2="50" y2="118" stroke={LINE} strokeWidth="1" />
      <circle cx="50" cy="118" r="3" fill={DOT} />

      <line x1="18" y1="178" x2="54" y2="192" stroke={LINE} strokeWidth="1" />
      <circle cx="54" cy="192" r="3" fill={DOT} />

      <line x1="182" y1="58" x2="146" y2="78" stroke={LINE} strokeWidth="1" />
      <circle cx="146" cy="78" r="3" fill={DOT} />
      <line x1="182" y1="58" x2="150" y2="118" stroke={LINE} strokeWidth="1" />
      <circle cx="150" cy="118" r="3" fill={DOT} />

      <line x1="182" y1="178" x2="146" y2="192" stroke={LINE} strokeWidth="1" />
      <circle cx="146" cy="192" r="3" fill={DOT} />
    </svg>
  );
}

function LabelBlock({
  title,
  description,
  align,
}: {
  title: string;
  description: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-extrabold leading-snug sm:text-sm" style={{ color: NAVY }}>
        {title}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-[#5C6478] sm:text-xs">{description}</p>
    </div>
  );
}

type Props = {
  footer?: ReactNode;
  className?: string;
};

export function WhyWeNeedScanPhotosCard({ footer, className = "" }: Props) {
  const { title, subtitle, left, right } = WHY_WE_NEED_SCAN_PHOTOS;

  return (
    <section
      className={`overflow-hidden rounded-[22px] border border-[rgba(224,112,136,0.22)] shadow-sm ${className}`}
      style={{ backgroundColor: CARD_BG }}
      aria-label="Scan complete"
    >
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <h2
          className="text-center text-sm font-extrabold uppercase tracking-[0.08em] sm:text-base"
          style={{ color: NAVY }}
        >
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-xs leading-relaxed text-[#5C6478] sm:text-sm">
          {subtitle}
        </p>

        <div className="mx-auto mt-4 grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-5">
          <div className="flex flex-col gap-5 sm:gap-6">
            <LabelBlock {...left[0]} align="right" />
            <LabelBlock {...left[1]} align="right" />
          </div>
          <div className="self-center">
            <FaceDiagram />
          </div>
          <div className="flex flex-col gap-5 sm:gap-6">
            <LabelBlock {...right[0]} align="left" />
            <LabelBlock {...right[1]} align="left" />
          </div>
        </div>

        {footer ? (
          <div className="mt-5 border-t border-[rgba(224,112,136,0.2)] pt-5 sm:mt-6 sm:pt-6">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

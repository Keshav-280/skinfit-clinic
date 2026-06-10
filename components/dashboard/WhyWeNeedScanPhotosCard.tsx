"use client";

import type { ReactNode } from "react";
import { WHY_WE_NEED_SCAN_PHOTOS } from "@/src/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const CARD_BG = "#F6F5F2";

function FaceDiagram() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/face-outline-diagram.png?v=3"
      alt=""
      className="mx-auto h-[160px] w-[160px] rounded-2xl object-contain sm:h-[200px] sm:w-[200px]"
      aria-hidden
    />
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
        <div className="flex flex-col md:flex-row md:items-center md:gap-8">
          
          {/* Left Column: Face Diagram Explanation */}
          <div className="flex-1">
            <h2
              className="text-center md:text-left text-sm font-extrabold uppercase tracking-[0.08em] sm:text-base"
              style={{ color: NAVY }}
            >
              {title}
            </h2>
            <p className="mx-auto md:mx-0 mt-2 max-w-lg text-center md:text-left text-xs leading-relaxed text-[#5C6478] sm:text-sm">
              {subtitle}
            </p>

            <div className="mx-auto mt-6 grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-5">
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
          </div>

          {/* Divider and Right Column: Status / Footer */}
          {footer ? (
            <>
              <div className="hidden md:block w-px self-stretch bg-[rgba(224,112,136,0.18)] my-2" />
              <div className="block md:hidden border-t border-[rgba(224,112,136,0.18)] my-5" />
              
              <div className="flex-1 flex flex-col justify-center">
                {footer}
              </div>
            </>
          ) : null}

        </div>
      </div>
    </section>
  );
}

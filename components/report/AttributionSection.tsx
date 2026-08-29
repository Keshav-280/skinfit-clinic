"use client";

import { useState } from "react";
import { REPORT_CARD, REPORT_PILL } from "./reportCopy";

type AttributionCard = {
  label: string;
  text: string;
};

type AttributionSectionProps = {
  cards: AttributionCard[];
};

export function AttributionSection({ cards }: AttributionSectionProps) {
  const [open, setOpen] = useState<string | null>(null);
  if (cards.length === 0) return null;

  return (
    <section className={`${REPORT_CARD} px-3.5 py-4`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={REPORT_PILL}>Likely factors</span>
        <span className="text-[11px] font-medium text-[#8B93A4]">Not causation</span>
      </div>
      <div className="flex flex-col gap-2">
        {cards.map((card) => {
          const on = open === card.label;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setOpen(on ? null : card.label)}
              className="rounded-2xl bg-white/70 px-3.5 py-3 text-left"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B93A4]">
                {card.label}
              </p>
              <p
                className={`mt-1 text-[13px] leading-[1.45] text-[#1A2035] ${
                  on ? "" : "line-clamp-2"
                }`}
              >
                {card.text}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

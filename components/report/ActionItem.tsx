"use client";

import { useState } from "react";
import { actionLead } from "./reportCopy";

type ActionItemProps = {
  number: number;
  text: string;
  last?: boolean;
};

export function ActionItem({ number, text, last = false }: ActionItemProps) {
  const [open, setOpen] = useState(false);
  const lead = actionLead(text);
  const hasMore = text.trim().length > lead.length;

  return (
    <button
      type="button"
      onClick={() => hasMore && setOpen((v) => !v)}
      className="relative flex w-full gap-3 py-2.5 text-left"
    >
      {!last ? (
        <span
          className="absolute bottom-0 left-[13px] top-8 w-px bg-[#2C3E6B]/15"
          aria-hidden
        />
      ) : null}
      <span className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-[12px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(44,62,107,0.7)]">
        {number}
      </span>
      <span className="min-w-0 pb-1">
        <span className="block text-[14px] font-semibold leading-snug text-[#1A2035]">
          {lead}
        </span>
        {open && hasMore ? (
          <span className="mt-1 block text-[12px] leading-[1.5] text-[#5B6478]">
            {text}
          </span>
        ) : hasMore ? (
          <span className="mt-0.5 block text-[11px] font-medium text-[#8B93A4]">
            Tap for how
          </span>
        ) : null}
      </span>
    </button>
  );
}

"use client";

import { useState } from "react";
import { actionLead } from "./reportCopy";

type ActionItemProps = {
  number: number;
  text?: string;
  title?: string;
  detail?: string;
  last?: boolean;
};

function sameLine(a: string, b: string): boolean {
  const na = a.replace(/\s+/g, " ").trim().toLowerCase();
  const nb = b.replace(/\s+/g, " ").trim().toLowerCase();
  if (!na || !nb) return true;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na);
}

export function ActionItem({
  number,
  text,
  title,
  detail,
  last = false,
}: ActionItemProps) {
  const [open, setOpen] = useState(false);
  const resolvedTitle = (title ?? actionLead(text ?? "")).trim();
  let resolvedDetail = (detail ?? "").trim();
  if (!resolvedDetail && text?.trim()) {
    const parts = text
      .trim()
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);
    resolvedDetail = parts.slice(1).join(" ").trim();
  }
  const hasMore =
    resolvedDetail.length > 0 && !sameLine(resolvedTitle, resolvedDetail);

  return (
    <button
      type="button"
      onClick={() => hasMore && setOpen((v) => !v)}
      className="relative flex w-full gap-3 py-2.5 text-left"
    >
      {!last ? (
        <span
          className="absolute bottom-0 left-[13px] top-8 w-px bg-[#1E1B31]/15"
          aria-hidden
        />
      ) : null}
      <span className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] text-[12px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(30, 27, 49,0.7)]">
        {number}
      </span>
      <span className="min-w-0 pb-1">
        <span className="block text-[14px] font-semibold leading-snug text-[#1A2035]">
          {resolvedTitle}
        </span>
        {open && hasMore ? (
          <span className="mt-1 block text-[12px] leading-[1.5] text-[#5B6478]">
            {resolvedDetail}
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

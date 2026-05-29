"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { format, isValid, parseISO } from "date-fns";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Journal/tracker date from `?date=YYYY-MM-DD`, else local today. */
export function useJournalTrackerDate(): string {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const raw = searchParams.get("date");
    if (raw && YMD_RE.test(raw)) {
      const d = parseISO(`${raw}T12:00:00`);
      if (isValid(d)) return raw.slice(0, 10);
    }
    return format(new Date(), "yyyy-MM-dd");
  }, [searchParams]);
}

export function journalTrackerHref(path: string, dateYmd: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}date=${encodeURIComponent(dateYmd)}`;
}

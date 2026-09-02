"use client";

import { useEffect, useMemo, useState } from "react";

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export type EndOfDayCountdown = {
  hours: number;
  minutes: number;
  seconds: number;
  /** Local calendar day elapsed 0-1 (midnight → 11:59:59.999 PM). */
  dayProgress: number;
  msLeft: number;
  formatted: string;
  shortLabel: string;
  isLastHour: boolean;
};

/** Time remaining until end of the local calendar day (11:59:59.999 PM). */
export function computeEndOfDayCountdown(now: Date): EndOfDayCountdown {
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();
  const start = new Date(y, mo, d, 0, 0, 0, 0);
  const end = new Date(y, mo, d, 23, 59, 59, 999);
  const totalMs = end.getTime() - start.getTime();
  const msLeft = Math.max(0, end.getTime() - now.getTime());
  const elapsed = now.getTime() - start.getTime();
  const dayProgress =
    totalMs > 0 ? Math.min(1, Math.max(0, elapsed / totalMs)) : 1;

  const totalSec = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const formatted = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  const shortLabel =
    hours > 0
      ? `${hours}h ${pad2(minutes)}m`
      : minutes > 0
        ? `${minutes}m ${pad2(seconds)}s`
        : `${seconds}s`;

  return {
    hours,
    minutes,
    seconds,
    dayProgress,
    msLeft,
    formatted,
    shortLabel,
    isLastHour: msLeft > 0 && msLeft <= 3600_000,
  };
}

export function useEndOfDayCountdown(): EndOfDayCountdown {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => computeEndOfDayCountdown(new Date()), [tick]);
}

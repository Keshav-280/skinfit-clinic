"use client";

import { useEffect, useState } from "react";

/** Animate an integer from 0 to target when `on` becomes true. */
export function useCountUp(target: number, on: boolean, ms = 700): number {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!on) {
      setN(0);
      return;
    }
    const safe = Math.max(0, Math.round(target));
    if (safe === 0) {
      setN(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      setN(Math.round(safe * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on, ms]);

  return n;
}

"use client";

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type ThenNowCompareProps = {
  previousImage: { url: string; date: string };
  currentImage: { url: string; date: string };
  caption?: string;
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function ThenNowCompare({
  previousImage,
  currentImage,
  caption = "Both captures passed quality checks, so this comparison is reliable.",
}: ThenNowCompareProps) {
  const [position, setPosition] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    setPosition(clampPct(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromClientX(e.clientX);
    },
    [updateFromClientX]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    },
    [updateFromClientX]
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPosition((p) => clampPct(p - 2));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPosition((p) => clampPct(p + 2));
    }
  }, []);

  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <div className="mb-[15px] flex items-baseline justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
          Then / now
        </h2>
      </div>
      <div
        ref={frameRef}
        role="slider"
        aria-label="Compare previous and current scan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative mb-3 aspect-[16/11] cursor-ew-resize touch-none select-none overflow-hidden rounded-[14px] bg-kai-sage-2"
      >
        {/* Then — full frame underneath */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previousImage.url}
          alt={`Previous scan ${previousImage.date}`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[2] rounded bg-black/45 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
          {previousImage.date}
        </span>

        {/* Now — clipped from the divider to the right edge */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage.url}
            alt={`Current scan ${currentImage.date}`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute bottom-2.5 right-2.5 rounded bg-black/45 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
            {currentImage.date}
          </span>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-[3] w-0.5 -translate-x-1/2 bg-white"
          style={{ left: `${position}%` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 z-[4] flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-kai-navy shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          style={{ left: `${position}%` }}
          aria-hidden
        >
          <span className="text-[10px] font-bold tracking-tight text-white">
            ↔
          </span>
        </div>
      </div>
      <p className="text-[11.5px] leading-[1.45] text-kai-ink-3">{caption}</p>
    </section>
  );
}

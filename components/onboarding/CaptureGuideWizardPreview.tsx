"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { animate, motion, useMotionValue } from "framer-motion";
import { Camera, Check, ChevronLeft, ChevronRight } from "lucide-react";

import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";

const easeOut = [0.22, 1, 0.36, 1] as const;

/** Reference photos for each capture angle — same person, same lighting/background. */
const REFERENCE_PHOTO_BY_ID: Record<string, string> = {
  centre: "/images/capture-guide/centre.png",
  left: "/images/capture-guide/left.png",
  right: "/images/capture-guide/right.png",
  eyes_closed: "/images/capture-guide/eyes_closed.png",
  smiling: "/images/capture-guide/smiling.png",
};

const DRAG_THRESHOLD = 60;

export function CaptureGuideWizardPreview() {
  const router = useRouter();
  const steps = FACE_SCAN_CAPTURE_STEPS;
  const [index, setIndex] = useState(0);
  const [captured, setCaptured] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState(false);
  const [width, setWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);

  const step = steps[index]!;
  const allCaptured = captured.size === steps.length;

  // Measure the visible viewport so the track can be positioned in real pixels
  // instead of percentages (percentages don't resolve reliably against an
  // auto-width flex track, which was silently breaking the swipe entirely).
  useEffect(() => {
    function measure() {
      if (viewportRef.current) setWidth(viewportRef.current.offsetWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function goTo(next: number) {
    const wrapped = ((next % steps.length) + steps.length) % steps.length;
    setIndex(wrapped);
  }

  // `drag="x"` takes ownership of its own internal x motion value unless one is
  // shared explicitly — so position must be driven through `dragX` (via the
  // imperative `animate()` function), not a declarative `animate` JSX prop,
  // or programmatic snapping silently gets ignored.
  useEffect(() => {
    if (width === 0) return;
    const controls = animate(dragX, -index * width, {
      duration: 0.4,
      ease: easeOut,
    });
    return () => controls.stop();
  }, [index, width, dragX]);

  // Auto-advance every 1s, looping back to the first photo after the last.
  // Resets whenever `index` changes (manual swipe/click also restarts the timer).
  useEffect(() => {
    if (allCaptured || width === 0) return;
    const t = window.setTimeout(() => goTo(index + 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, allCaptured, width]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -DRAG_THRESHOLD && index < steps.length - 1) {
      goTo(index + 1);
    } else if (info.offset.x > DRAG_THRESHOLD && index > 0) {
      goTo(index - 1);
    } else {
      // Snap back — index is unchanged so the effect above won't re-fire.
      animate(dragX, -index * width, { duration: 0.3, ease: easeOut });
    }
  }

  function takePicture() {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);

    setCaptured((prev) => {
      const next = new Set(prev);
      next.add(step.id);
      return next;
    });

    const nextUncaptured = steps.findIndex(
      (s, i) => i > index && !captured.has(s.id) && s.id !== step.id
    );
    window.setTimeout(() => {
      if (nextUncaptured !== -1) {
        goTo(nextUncaptured);
      } else {
        const firstUncaptured = steps.findIndex((s) => s.id !== step.id && !captured.has(s.id));
        if (firstUncaptured !== -1) goTo(firstUncaptured);
      }
    }, 450);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Capture flash */}
      {flash ? (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] bg-white"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      ) : null}

      <div className="flex flex-1 flex-col px-6 pt-6">
        {/* Top row: back + dot pagination + skip */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#2C3E6B] transition hover:bg-[#2C3E6B]/8 disabled:opacity-0"
            aria-label="Previous angle"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to ${s.title}`}
                className="p-1"
              >
                <span
                  className={`block rounded-full transition-all ${
                    i === index
                      ? "h-2 w-6 bg-[#2C3E6B]"
                      : captured.has(s.id)
                        ? "h-2 w-2 bg-[#2C3E6B]/50"
                        : "h-2 w-2 bg-[#E5E7EB]"
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === steps.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#2C3E6B] transition hover:bg-[#2C3E6B]/8 disabled:opacity-0"
            aria-label="Next angle"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Swipeable carousel — each page bundles illustration + title + subtitle + tips */}
        <div ref={viewportRef} className="mt-2 flex-1 overflow-hidden">
          <motion.div
            className="flex h-full"
            drag="x"
            dragConstraints={{ left: -(steps.length - 1) * width, right: 0 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
            style={{ x: dragX }}
          >
            {steps.map((s) => {
              const photoSrc = REFERENCE_PHOTO_BY_ID[s.id];
              const done = captured.has(s.id);
              return (
                <div
                  key={s.id}
                  style={{ width: width || "100%" }}
                  className="flex h-full shrink-0 flex-col items-center justify-center"
                >
                  <div className="relative h-64 w-52 overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-sm">
                    {photoSrc ? (
                      <Image
                        src={photoSrc}
                        alt={`${s.title} reference photo`}
                        fill
                        sizes="208px"
                        className="object-cover"
                        priority
                      />
                    ) : null}
                    {done ? (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 18 }}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#2C3E6B] shadow-md"
                      >
                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                      </motion.span>
                    ) : null}
                  </div>

                  <h1 className="mt-3 text-center text-[22px] font-extrabold leading-tight tracking-tight text-[#18181b]">
                    {s.title}
                  </h1>
                  <p className="mt-1.5 max-w-xs text-center text-sm leading-relaxed text-[#6B7280]">
                    {s.subtitle}
                  </p>

                  <div className="mt-4 flex w-full flex-col gap-2 px-2">
                    {s.tips.map((tip, i) => (
                      <div
                        key={tip}
                        className="flex items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B]/10 text-[10px] font-bold text-[#2C3E6B]">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-[#18181b]">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Pinned bottom capture bar */}
      <div
        className="sticky bottom-0 flex flex-col items-center gap-3 bg-[#F5F3EF]/95 px-6 pb-8 pt-4 backdrop-blur-sm"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        {allCaptured ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => router.push("/onboarding/capture/photos")}
            className="w-full rounded-2xl bg-[#2C3E6B] py-4 text-center text-[15px] font-bold text-white transition hover:bg-[#243456]"
          >
            All 5 angles captured. Continue
          </motion.button>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              {captured.size}/{steps.length} captured
            </p>
            <button
              type="button"
              onClick={takePicture}
              aria-label="Take picture"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-[#2C3E6B]/15 bg-white shadow-lg transition active:scale-95"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2C3E6B]">
                <Camera className="h-6 w-6 text-white" />
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

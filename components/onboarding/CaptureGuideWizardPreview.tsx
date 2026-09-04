"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { animate, motion, useMotionValue } from "framer-motion";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight } from "lucide-react";

import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";

const easeOut = [0.22, 1, 0.36, 1] as const;

/** Reference photos for each capture angle - same person, same lighting/background. */
const REFERENCE_PHOTO_BY_ID: Record<string, string> = {
  centre: "/images/capture-guide/centre.png",
  left: "/images/capture-guide/left.png",
  right: "/images/capture-guide/right.png",
};

const DRAG_THRESHOLD = 60;
const AUTO_SWIPE_MS = 5000;

export function CaptureGuideWizard({
  onTakePicture,
  onBack,
  embedded = false,
}: {
  onTakePicture: () => void;
  onBack?: () => void;
  /** Sit between dashboard header + bottom nav instead of a full-screen page. */
  embedded?: boolean;
}) {
  const steps = FACE_SCAN_CAPTURE_STEPS;
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [held, setHeld] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const next = el.clientWidth;
      if (next > 0) setWidth(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function goTo(next: number) {
    const wrapped = ((next % steps.length) + steps.length) % steps.length;
    setIndex(wrapped);
  }

  useEffect(() => {
    if (width === 0) return;
    const controls = animate(dragX, -index * width, {
      duration: 0.4,
      ease: easeOut,
    });
    return () => controls.stop();
  }, [index, width, dragX]);

  useEffect(() => {
    if (width === 0 || held) return;
    const t = window.setTimeout(() => goTo(index + 1), AUTO_SWIPE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width, held]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -DRAG_THRESHOLD && index < steps.length - 1) {
      goTo(index + 1);
    } else if (info.offset.x > DRAG_THRESHOLD && index > 0) {
      goTo(index - 1);
    } else {
      animate(dragX, -index * width, { duration: 0.3, ease: easeOut });
    }
  }

  return (
    <div
      className={`mx-auto flex w-full min-w-0 max-w-md flex-col overflow-x-hidden ${
        embedded
          ? "min-h-[calc(100dvh-8.5rem)]"
          : "min-h-dvh"
      }`}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-4 sm:px-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#1E1B31]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        ) : null}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E1B31] transition hover:bg-[#1E1B31]/8 disabled:opacity-0"
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
                    i === index ? "h-2 w-6 bg-[#1E1B31]" : "h-2 w-2 bg-[#E5E7EB]"
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === steps.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E1B31] transition hover:bg-[#1E1B31]/8 disabled:opacity-0"
            aria-label="Next angle"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div ref={viewportRef} className="mt-2 min-h-0 min-w-0 w-full flex-1 overflow-hidden">
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
              return (
                <div
                  key={s.id}
                  style={{
                    width: width || "100%",
                    flex: width ? `0 0 ${width}px` : "0 0 100%",
                  }}
                  className="box-border flex h-full min-w-0 flex-col items-center justify-center overflow-hidden px-1"
                >
                  <div
                    onPointerDown={() => setHeld(true)}
                    onPointerUp={() => setHeld(false)}
                    onPointerLeave={() => setHeld(false)}
                    onPointerCancel={() => setHeld(false)}
                    className="relative h-64 w-52 max-w-full shrink-0 touch-none select-none overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-sm"
                  >
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
                  </div>

                  <h1 className="mt-3 w-full text-center text-[22px] font-extrabold leading-tight tracking-tight text-[#18181b]">
                    {s.title}
                  </h1>
                  <p className="mt-1.5 w-full px-1 text-center text-sm leading-relaxed text-pretty text-[#6B7280]">
                    {s.subtitle}
                  </p>

                  <div className="mt-4 flex w-full min-w-0 flex-col gap-2">
                    {s.tips.map((tip, i) => (
                      <div
                        key={tip}
                        className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 sm:px-4"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E1B31]/10 text-[10px] font-bold text-[#1E1B31]">
                          {i + 1}
                        </span>
                        <span className="min-w-0 text-sm font-medium leading-snug text-[#18181b]">
                          {tip}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <div
        className={`flex shrink-0 flex-col items-center gap-3 bg-[#FAF8F5]/95 px-4 pt-4 sm:px-6 ${
          embedded
            ? "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-8"
            : "pb-[max(2rem,env(safe-area-inset-bottom,0px))]"
        }`}
      >
        <p className="w-full text-center text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          Ready? Tap to open the camera
        </p>
        <button
          type="button"
          onClick={onTakePicture}
          aria-label="Take picture"
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-4 border-[#1E1B31]/15 bg-white shadow-lg transition active:scale-95"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1E1B31]">
            <Camera className="h-6 w-6 text-white" />
          </span>
        </button>
      </div>
    </div>
  );
}

export function CaptureGuideWizardPreview() {
  const router = useRouter();
  return (
    <CaptureGuideWizard
      onTakePicture={() =>
        router.push("/onboarding/capture/photos?autoCamera=1")
      }
      onBack={() => router.back()}
    />
  );
}

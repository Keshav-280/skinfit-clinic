"use client";

import { motion } from "framer-motion";

const INK = "#1E1B31";
const FACE = "#FAF8F5";

const BREATH = {
  duration: 2.8,
  repeat: Infinity,
  ease: [0.42, 0, 0.58, 1] as const,
};

type SkinFitLoaderSize = "page" | "section" | "mark";

type SkinFitLoaderProps = {
  title?: string;
  subtitle?: string;
  size?: SkinFitLoaderSize;
  className?: string;
};

function SmileMark({ size }: { size: number }) {
  const smile = size * 0.42;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {[0.55, 0.78, 1].map((scale, i) => (
        <motion.span
          key={scale}
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor:
              i === 2 ? "rgba(223,157,164,0.55)" : "rgba(30,27,49,0.22)",
          }}
          animate={{ scale: [scale, scale + 0.12, scale], opacity: [0.45, 0.12, 0.45] }}
          transition={{ ...BREATH, delay: i * 0.35 }}
        />
      ))}
      <motion.div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size * 0.46,
          height: size * 0.46,
          backgroundColor: INK,
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={BREATH}
      >
        <svg
          width={smile}
          height={smile * 0.78}
          viewBox="0 0 64 50"
          fill="none"
        >
          <path
            d="M12 20 Q20 27 28 20"
            stroke={FACE}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M36 20 Q44 27 52 20"
            stroke={FACE}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <motion.path
            stroke={FACE}
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
            animate={{
              d: ["M22 34 Q32 37 42 34", "M18 33 Q32 44 46 33", "M22 34 Q32 37 42 34"],
            }}
            transition={BREATH}
          />
        </svg>
      </motion.div>
    </div>
  );
}

export function SkinFitLoader({
  title,
  subtitle,
  size = "page",
  className = "",
}: SkinFitLoaderProps) {
  if (size === "mark") {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        role="status"
        aria-label={title ?? "Loading"}
      >
        <SmileMark size={56} />
        <span className="sr-only">{title ?? "Loading"}</span>
      </div>
    );
  }

  const mark = size === "section" ? 72 : 120;
  const wrap =
    size === "page"
      ? "flex min-h-[60vh] flex-col items-center justify-center px-6 py-12"
      : "flex flex-col items-center justify-center px-4 py-6";

  return (
    <div className={`${wrap} ${className}`} role="status" aria-live="polite">
      <SmileMark size={mark} />
      {title ? (
        <p
          className={
            size === "section"
              ? "mt-4 text-center text-sm font-semibold text-[#1E1B31]"
              : "font-headline mt-6 text-center text-xl font-bold tracking-tight text-[#1E1B31] sm:text-2xl"
          }
        >
          {title}
        </p>
      ) : null}
      {subtitle ? (
        <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-[#6B7280]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

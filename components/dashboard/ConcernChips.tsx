"use client";

import { classifySkinParamMetric } from "@/src/lib/clarityGrade";

export type ConcernChipId =
  | "all"
  | "acne"
  | "acne_scars"
  | "pigmentation"
  | "wrinkles"
  | "under_eye"
  | "sagging_volume";

export type ConcernChipItem = {
  id: ConcernChipId;
  label: string;
  /** Raw clarity 0–100 for color + display. */
  score: number | null;
  scoreLabel: string;
};

export function ConcernChips({
  items,
  activeId,
  onSelect,
}: {
  items: ConcernChipItem[];
  activeId: ConcernChipId;
  onSelect: (id: ConcernChipId) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Skin concerns"
    >
      <Chip
        selected={activeId === "all"}
        onClick={() => onSelect("all")}
        label="All"
      />
      {items.map((item) => {
        const color =
          item.score != null
            ? classifySkinParamMetric(item.score).color
            : "#9CA3AF";
        return (
          <Chip
            key={item.id}
            selected={activeId === item.id}
            onClick={() => onSelect(item.id === activeId ? "all" : item.id)}
            label={item.label}
            scoreLabel={item.scoreLabel}
            dotColor={color}
          />
        );
      })}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  label,
  scoreLabel,
  dotColor,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  scoreLabel?: string;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
        selected
          ? "border-[#1E1B31] bg-[#1E1B31] text-white shadow-sm"
          : "border-[rgba(30, 27, 49,0.18)] bg-white text-[#1E1B31] hover:border-[rgba(30, 27, 49,0.35)]"
      }`}
    >
      {dotColor ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: selected ? "#fff" : dotColor }}
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
      {scoreLabel ? (
        <span className={selected ? "text-white/80" : "text-[#6B7280]"}>
          {scoreLabel}
        </span>
      ) : null}
    </button>
  );
}

"use client";

import { GripVertical } from "lucide-react";
import type { DoctorSnippetGroup } from "@/src/lib/doctorQuickSnippets";
import { writeDoctorSnippetToDataTransfer } from "@/src/lib/doctorQuickSnippets";

type DoctorQuickSnippetPaletteProps = {
  groups: DoctorSnippetGroup[];
  onInsert?: (text: string) => void;
  hint?: string;
  className?: string;
};

export function DoctorQuickSnippetPalette({
  groups,
  onInsert,
  hint = "Drag onto a field or click to insert",
  className = "",
}: DoctorQuickSnippetPaletteProps) {
  const items = groups.flatMap((g) => g.items);
  if (items.length === 0) return null;

  return (
    <div
      className={`rounded-lg border border-dashed border-[#2C3E6B]/20 bg-[#F6F4EB]/50 px-2.5 py-2 ${className}`}
    >
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
        <GripVertical className="h-3 w-3 shrink-0" aria-hidden />
        Quick phrases
      </p>
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 text-[10px] font-medium text-[#2C3E6B]/55">{group.label}</p>
            <div className="flex flex-wrap gap-1">
              {group.items.map((item) => (
                <button
                  key={`${group.label}-${item}`}
                  type="button"
                  draggable
                  title={item}
                  onDragStart={(e) => {
                    writeDoctorSnippetToDataTransfer(e.dataTransfer, item);
                  }}
                  onClick={() => onInsert?.(item)}
                  className="max-w-full cursor-grab truncate rounded-md border border-[#2C3E6B]/15 bg-white px-1.5 py-0.5 text-left text-[10px] font-medium text-[#2C3E6B] hover:border-[#2C3E6B]/30 hover:bg-white active:cursor-grabbing"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[10px] leading-snug text-[#2C3E6B]/50">{hint}</p>
      ) : null}
    </div>
  );
}

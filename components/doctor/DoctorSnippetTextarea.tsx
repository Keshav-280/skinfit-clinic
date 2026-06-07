"use client";

import type { DoctorSnippetGroup } from "@/src/lib/doctorQuickSnippets";
import type { DoctorCustomSnippetScope } from "@/src/lib/doctorCustomSnippets";
import {
  appendDoctorSnippet,
  readDoctorSnippetFromDataTransfer,
} from "@/src/lib/doctorQuickSnippets";
import { DoctorQuickSnippetPalette } from "@/components/doctor/DoctorQuickSnippetPalette";
import { doctorPatientPageFormInputClass } from "@/components/doctor/DoctorUiPrimitives";

type DoctorSnippetTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  groups: DoctorSnippetGroup[];
  rows?: number;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  paletteHint?: string;
  customPhraseScope?: DoctorCustomSnippetScope;
};

export function DoctorSnippetTextarea({
  value,
  onChange,
  groups,
  rows = 2,
  placeholder,
  ariaLabel,
  className = "",
  paletteHint,
  customPhraseScope = "feedback",
}: DoctorSnippetTextareaProps) {
  const insertSnippet = (snippet: string) => {
    onChange(appendDoctorSnippet(value, snippet));
  };

  return (
    <div className="space-y-2">
      <DoctorQuickSnippetPalette
        groups={groups}
        onInsert={insertSnippet}
        hint={paletteHint}
        customPhraseScope={customPhraseScope}
      />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const snippet = readDoctorSnippetFromDataTransfer(e.dataTransfer);
          if (snippet) insertSnippet(snippet);
        }}
        className={`${doctorPatientPageFormInputClass} min-h-[3.25rem] resize-y py-1.5 ${className}`}
      />
    </div>
  );
}

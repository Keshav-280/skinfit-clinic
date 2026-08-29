"use client";

import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function ScanPhotoGuideDismissCheckbox({ checked, onChange, className = "" }: Props) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#1E1B31]/15 bg-white/35 px-3.5 py-3.5 text-left text-sm leading-snug text-[#374151] ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#1E1B31]/35 accent-[#1E1B31]"
      />
      <span>
        I&apos;ve read the photo tips —{" "}
        <span className="font-semibold" style={{ color: SKINFIT_THEME.navy }}>
          skip them next time
        </span>
        {!checked ? (
          <span className="mt-1 block text-xs font-medium text-[#64748B]">
            We&apos;ll show them again before your next camera scan.
          </span>
        ) : null}
      </span>
    </label>
  );
}

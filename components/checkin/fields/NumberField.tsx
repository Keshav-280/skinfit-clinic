"use client";

type NumberFieldProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
};

export function NumberField({
  label,
  value,
  onChange,
  unit,
  min = 40,
  max = 200,
}: NumberFieldProps) {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] font-semibold text-kai-ink">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) {
              onChange(null);
              return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            onChange(n);
          }}
          className="w-full rounded-[12px] border border-kai-rule bg-white px-3.5 py-3 text-[13px] text-kai-ink outline-none focus:border-kai-navy"
          placeholder="e.g. 78"
        />
        {unit ? (
          <span className="shrink-0 text-[12px] font-semibold text-kai-ink-3">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

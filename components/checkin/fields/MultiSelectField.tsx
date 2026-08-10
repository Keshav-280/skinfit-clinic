"use client";

type MultiSelectFieldProps = {
  label: string;
  options: Array<{ key: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  noneKey?: string;
  maxSelections?: number;
};

export function MultiSelectField({
  label,
  options,
  value,
  onChange,
  noneKey = "none",
  maxSelections,
}: MultiSelectFieldProps) {
  function toggle(key: string) {
    if (key === noneKey) {
      onChange(value.includes(noneKey) ? [] : [noneKey]);
      return;
    }
    let next = value.filter((v) => v !== noneKey);
    if (next.includes(key)) {
      next = next.filter((v) => v !== key);
    } else {
      next = [...next, key];
      if (maxSelections != null && next.length > maxSelections) {
        next = next.slice(next.length - maxSelections);
      }
    }
    onChange(next);
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[13px] font-semibold text-kai-ink">{label}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const on = value.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className={`rounded-[12px] border px-3.5 py-3 text-left text-[13px] font-semibold transition ${
                on
                  ? "border-kai-navy bg-kai-navy text-white"
                  : "border-kai-rule bg-white text-kai-ink hover:border-kai-navy/40"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

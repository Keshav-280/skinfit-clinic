"use client";

type SingleSelectFieldProps = {
  label: string;
  options: Array<{ key: string; label: string }>;
  value: string | null;
  onChange: (value: string) => void;
};

export function SingleSelectField({
  label,
  options,
  value,
  onChange,
}: SingleSelectFieldProps) {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] font-semibold text-kai-ink">{label}</p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const on = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
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

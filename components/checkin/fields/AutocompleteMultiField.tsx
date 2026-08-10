"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

type AutocompleteMultiFieldProps = {
  label: string;
  vocabulary: Array<{ key: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  noneKey?: string;
};

export function AutocompleteMultiField({
  label,
  vocabulary,
  value,
  onChange,
  placeholder = "Type to search…",
  noneKey = "none",
}: AutocompleteMultiFieldProps) {
  const [query, setQuery] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vocabulary.slice(0, 8);
    return vocabulary
      .filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          v.key.toLowerCase().includes(q.replace(/\s+/g, "_"))
      )
      .slice(0, 8);
  }, [query, vocabulary]);

  const labelFor = (key: string) => {
    if (key.startsWith("other:")) return key.slice(6);
    return vocabulary.find((v) => v.key === key)?.label ?? key;
  };

  function add(key: string) {
    if (key === "other") {
      setOtherOpen(true);
      setQuery("");
      return;
    }
    if (key === noneKey) {
      onChange([noneKey]);
      setQuery("");
      return;
    }
    const withoutNone = value.filter((v) => v !== noneKey);
    if (withoutNone.includes(key)) return;
    onChange([...withoutNone, key]);
    setQuery("");
  }

  function remove(key: string) {
    onChange(value.filter((v) => v !== key));
  }

  function commitOther() {
    const t = otherText.trim();
    if (!t) return;
    const key = `other:${t.toLowerCase().replace(/\s+/g, "_").slice(0, 48)}`;
    const withoutNone = value.filter((v) => v !== noneKey && v !== "other");
    if (!withoutNone.includes(key)) onChange([...withoutNone, key]);
    setOtherText("");
    setOtherOpen(false);
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[13px] font-semibold text-kai-ink">{label}</p>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-kai-navy px-2.5 py-1 text-[11.5px] font-semibold text-white"
            >
              {labelFor(key)}
              <button
                type="button"
                aria-label={`Remove ${labelFor(key)}`}
                onClick={() => remove(key)}
                className="rounded-full p-0.5 hover:bg-white/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[12px] border border-kai-rule bg-white px-3.5 py-3 text-[13px] text-kai-ink outline-none focus:border-kai-navy"
      />
      {(query.trim() || filtered.length > 0) && (
        <ul className="overflow-hidden rounded-[12px] border border-kai-rule bg-white">
          {filtered.map((opt) => (
            <li key={opt.key}>
              <button
                type="button"
                onClick={() => add(opt.key)}
                className="w-full px-3.5 py-2.5 text-left text-[13px] text-kai-ink hover:bg-kai-sage"
              >
                {opt.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-[12px] text-kai-ink-3">
              No matches — try Another option from the list.
            </li>
          ) : null}
        </ul>
      )}
      {otherOpen ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Specify other…"
            className="min-w-0 flex-1 rounded-[12px] border border-kai-rule bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-kai-navy"
          />
          <button
            type="button"
            onClick={commitOther}
            className="rounded-[12px] bg-kai-navy px-3 py-2.5 text-[12px] font-semibold text-white"
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}

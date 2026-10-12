/**
 * Clinic portal look. Brand colours only:
 * navy #1E1B31, indigo #242A5F / #5B66A1 / #AEB9E8, blush #DF9DA4, sand #F0EAE2, cream #FAF8F5.
 */
export const CLINIC = {
  card: "rounded-2xl border border-[#E4E6F0] bg-white",
  cardPad: "rounded-2xl border border-[#E4E6F0] bg-white p-5",
  tile: "rounded-xl bg-[#F0EAE2] px-4 py-3",
  label: "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5B66A1]",
  muted: "text-sm text-[#5B66A1]",
  h1: "font-headline text-2xl font-semibold tracking-tight text-[#1E1B31]",
  h2: "font-headline text-lg font-semibold text-[#1E1B31]",
  btnPrimary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1E1B31] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#242A5F] disabled:opacity-50",
  btnGhost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E1B31]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#FAF8F5] disabled:opacity-50",
  btnBlush:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DF9DA4] px-4 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#d58e96] disabled:opacity-50",
  input:
    "w-full rounded-lg border border-[#E4E6F0] bg-white px-3.5 py-2.5 text-sm text-[#1E1B31] outline-none placeholder:text-[#5B66A1]/60 focus:border-[#1E1B31]/40 focus:ring-2 focus:ring-[#1E1B31]/10",
  noteError: "rounded-xl bg-[#F8EDEE] px-4 py-3 text-sm text-[#1E1B31]",
  noteOk: "rounded-xl bg-[#E8ECFC] px-4 py-3 text-sm text-[#1E1B31]",
  chip: "inline-flex items-center rounded-full bg-[#E8ECFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#242A5F]",
  chipBlush:
    "inline-flex items-center rounded-full bg-[#F8EDEE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E1B31]",
  chipSand:
    "inline-flex items-center rounded-full bg-[#F0EAE2] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E1B31]/70",
} as const;

export function initialsOf(name: string | null | undefined, fallback = "P"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase() || fallback;
}

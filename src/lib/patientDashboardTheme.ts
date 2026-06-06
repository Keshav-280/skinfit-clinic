/** Patient dashboard — exact mockup palette (web + mobile). */
export const PATIENT_MINT_BG = "#F2F9F2";
export const PATIENT_NAVY = "#2D3E6B";
export const PATIENT_NAVY_HOVER = "#243456";
export const PATIENT_GREEN = "#4CAF50";
export const PATIENT_CARD_BG = "#FFFFFF";
export const PATIENT_CARD_BORDER = "#E5E7EB";
export const PATIENT_TEXT = "#18181b";
export const PATIENT_MUTED = "#6B7280";

/** @deprecated use PATIENT_MINT_BG */
export const PATIENT_SAGE = "#E8EFE6";
/** @deprecated */
export const PATIENT_SAGE_MUTED = "#e0e5df";

export const patientDashboardCard =
  "rounded-[20px] border border-[#E5E7EB] bg-white p-5 md:p-6";

export const patientDashboardNavyCard =
  "rounded-[20px] bg-[#2D3E6B] p-5 md:p-6";

export const patientGlassShell = patientDashboardCard;

export const patientInnerCard =
  "rounded-xl border border-[#E5E7EB] bg-white";

export const patientSectionIcon =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2D3E6B]/10 text-[#2D3E6B]";

export const patientPageTitle =
  "text-2xl font-extrabold tracking-tight text-[#18181b] sm:text-3xl";

export const patientSectionTitle = "text-lg font-bold text-[#2D3E6B]";

export const patientKicker =
  "text-[11px] font-bold uppercase tracking-wide text-[#2D3E6B]/60";

export const patientMuted = "text-sm text-[#6B7280]";

export const patientPrimaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2D3E6B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#243456] disabled:cursor-not-allowed disabled:opacity-50";

export const patientSecondaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#2D3E6B] transition hover:bg-[#F2F9F2]";

export const patientInputBase =
  "rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-[#2D3E6B] placeholder:text-[#6B7280]/60 outline-none focus:border-[#2D3E6B]/40 focus:ring-2 focus:ring-[#2D3E6B]/10 disabled:opacity-60";

export const patientInput = `w-full max-w-full ${patientInputBase}`;

export const patientFormSection =
  "min-w-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6";

export const patientStatTile =
  "rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-3";

export const patientScoreChip =
  "rounded-md bg-[#F2F9F2] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#2D3E6B]";

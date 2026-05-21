/** Doctor portal theme (server-safe — no "use client"). */

export const DOCTOR_NAVY = "#2C3E6B";

/** Portal shell background — soft ivory. */
export const DOCTOR_IVORY = "#F6F4EB";
export const DOCTOR_IVORY_FROM = "#F4F2E8";
export const DOCTOR_IVORY_MID = "#F6F4EB";
export const DOCTOR_IVORY_TO = "#FAF8F4";

/** @deprecated use DOCTOR_IVORY_* — kept for imports that still reference sage names. */
export const DOCTOR_SAGE_FROM = DOCTOR_IVORY_FROM;
export const DOCTOR_SAGE_MID = DOCTOR_IVORY_MID;
export const DOCTOR_SAGE_TO = DOCTOR_IVORY_TO;

export const DOCTOR_SAGE_GRADIENT =
  `linear-gradient(180deg, ${DOCTOR_IVORY_FROM} 0%, ${DOCTOR_IVORY_MID} 50%, ${DOCTOR_IVORY_TO} 100%)`;

/** @deprecated use DOCTOR_IVORY_MID */
export const DOCTOR_BG = DOCTOR_IVORY_MID;

export const doctorPortalShellClass =
  "min-h-screen bg-[#F6F4EB] bg-gradient-to-b from-[#F4F2E8] via-[#F6F4EB] to-[#FAF8F4]";

/** Top portal bar — mostly opaque so header controls stay readable. */
export const doctorGlassHeaderClass =
  "border-b border-slate-200/70 bg-[#F6F4EB]/90 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-md";

/** Sticky in-page tab strip — no extra card behind tab buttons. */
export const doctorStickyTabsClass =
  "sticky z-10 border-b border-[#2C3E6B]/10 pb-3 pt-1";

export const doctorGlassSidebarClass =
  "border-r border-slate-200/60 bg-[#F6F4EB]/88 backdrop-blur-md";

/** Main content cards — solid enough to read over ivory shell. */
export const doctorCardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm";

/** Nested inputs / filters inside cards. */
export const doctorCardMutedClass =
  "rounded-xl border border-slate-200/70 bg-slate-50";

/** Floating menus (alerts, messages) — fully opaque over page content. */
export const doctorDropdownClass =
  "rounded-2xl border border-slate-200 bg-white shadow-lg";

export const doctorInsetStripClass = "border-t border-slate-200/70 bg-slate-50/80";

export const doctorBtnPrimaryClass =
  "rounded-lg bg-[#2C3E6B] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243356] disabled:opacity-50";

export const doctorFormInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15";

/** Pre-treatment form panel — navy accent, matches portal theme. */
export const doctorPanelPreClass =
  "rounded-xl border border-[#2C3E6B]/20 bg-[#2C3E6B]/5 p-4 shadow-sm";

/** Post-treatment form panel — solid card, navy labels. */
export const doctorPanelPostClass =
  "rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm";

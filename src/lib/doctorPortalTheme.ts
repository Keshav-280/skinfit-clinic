/** Doctor portal theme (server-safe — no "use client"). Matches patient SkinnFit dashboard. */

export const DOCTOR_NAVY = "#2C3E6B";
export const DOCTOR_SAGE_FROM = "#D6E4D0";
export const DOCTOR_SAGE_MID = "#E0EADA";
export const DOCTOR_SAGE_TO = "#EAF0E6";

export const DOCTOR_SAGE_GRADIENT =
  `linear-gradient(180deg, ${DOCTOR_SAGE_FROM} 0%, ${DOCTOR_SAGE_MID} 50%, ${DOCTOR_SAGE_TO} 100%)`;

/** @deprecated use DOCTOR_SAGE_MID */
export const DOCTOR_BG = DOCTOR_SAGE_MID;

export const doctorPortalShellClass =
  "min-h-screen bg-[#E0EADA] bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6]";

/** Top portal bar — mostly opaque so header controls stay readable. */
export const doctorGlassHeaderClass =
  "border-b border-slate-200/70 bg-[#F6F9F2]/90 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-md";

/** Sticky in-page tab strip — no extra card behind tab buttons. */
export const doctorStickyTabsClass =
  "sticky z-10 border-b border-[#2C3E6B]/10 pb-3 pt-1";

export const doctorGlassSidebarClass =
  "border-r border-slate-200/60 bg-[#F6F9F2]/88 backdrop-blur-md";

/** Main content cards — solid enough to read over sage gradient. */
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

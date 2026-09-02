/** Doctor portal theme (server-safe - no "use client"). */

export const DOCTOR_NAVY = "#1E1B31";

/** Portal shell background - soft ivory. */
export const DOCTOR_IVORY = "#FAF8F5";
export const DOCTOR_IVORY_FROM = "#F0EAE2";
export const DOCTOR_IVORY_MID = "#FAF8F5";
export const DOCTOR_IVORY_TO = "#FAF8F5";

/** @deprecated use DOCTOR_IVORY_* - kept for imports that still reference sage names. */
export const DOCTOR_SAGE_FROM = DOCTOR_IVORY_FROM;
export const DOCTOR_SAGE_MID = DOCTOR_IVORY_MID;
export const DOCTOR_SAGE_TO = DOCTOR_IVORY_TO;

export const DOCTOR_SAGE_GRADIENT =
  `linear-gradient(180deg, ${DOCTOR_IVORY_FROM} 0%, ${DOCTOR_IVORY_MID} 50%, ${DOCTOR_IVORY_TO} 100%)`;

/** @deprecated use DOCTOR_IVORY_MID */
export const DOCTOR_BG = DOCTOR_IVORY_MID;

/** Proportional darken - same warm ivory hue, ~percent% darker (RGB scale). */
function ivoryDarken(hex: string, percent: number): string {
  const n = hex.replace("#", "");
  const f = 1 - percent / 100;
  const r = Math.round(parseInt(n.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(n.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(n.slice(4, 6), 16) * f);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Page shell (#FAF8F5) → panel ~5.5% darker → field ~5.5% darker again. Same hue. */
export const DOCTOR_IVORY_PATIENTS_PANEL = ivoryDarken(DOCTOR_IVORY, 5.5); // #e8e7de
export const DOCTOR_IVORY_FIELD = ivoryDarken(DOCTOR_IVORY_PATIENTS_PANEL, 5.5); // #dbdad2
export const DOCTOR_IVORY_TILE = "#F2E9D8";
export const DOCTOR_IVORY_TILE_HOVER = ivoryDarken(DOCTOR_IVORY, 3);

/** Soft, low-offset shadows - avoid heavy drop shadows on ivory surfaces. */
const IVORY_SHADOW_SM =
  "shadow-[0_1px_2px_rgba(72,64,48,0.05),0_1px_3px_rgba(72,64,48,0.03)]";
const IVORY_SHADOW_MD = "shadow-[0_1px_3px_rgba(72,64,48,0.07)]";
const IVORY_SHADOW_LG =
  "shadow-[0_2px_8px_rgba(72,64,48,0.08),0_4px_16px_rgba(72,64,48,0.05)]";

/** Ivory panel surface - same as patient detail / patients directory cards. */
export const DOCTOR_PROFILE_CARD_BG = DOCTOR_IVORY_PATIENTS_PANEL;

export const doctorIvoryCardClass =
  `rounded-2xl bg-[#E8E7DE] ${IVORY_SHADOW_MD}`;

/** Doctor profile page - labels and hints on ivory card. */
export const doctorProfileLabelClass =
  "mb-1.5 block text-sm font-semibold text-[#1E1B31]";

export const doctorProfileHintClass = "text-xs text-[#1E1B31]/55";

/** Soft-white inputs on darker ivory panels - shadow lift, navy text. */
export const doctorIvoryFieldSoftClass =
  "rounded-xl bg-white/95 text-[#1E1B31] placeholder:text-[#1E1B31]/50 shadow-[0_1px_2px_rgba(72,64,48,0.06),0_2px_8px_rgba(72,64,48,0.05)]";

/** Inputs on ivory patient-detail cards - semi-transparent white so panel shows through. */
export const doctorPatientPageFormInputClass =
  "w-full rounded-lg bg-white/70 px-3 py-2 text-sm text-[#1E1B31] shadow-[inset_0_0_0_1px_rgba(30, 27, 49,0.12)] placeholder:text-[#1E1B31]/40 outline-none focus:bg-white/85 focus:shadow-[inset_0_0_0_1px_rgba(30, 27, 49,0.35),0_0_0_2px_rgba(30, 27, 49,0.12)]";
/** @deprecated use doctorPatientPageFormInputClass */
export const doctorScheduleFormInputClass = doctorPatientPageFormInputClass;

/** Profile form fields - same inputs as patient detail ivory cards. */
export const doctorProfileFieldClass = doctorPatientPageFormInputClass;

export const doctorProfileFieldReadOnlyClass =
  `${doctorPatientPageFormInputClass} cursor-default text-[#1E1B31]/70`;

/** Patients directory - ~5.5% darker than page ivory, same hue. */
export const doctorPatientsPanelClass =
  `rounded-2xl bg-[#E8E7DE] ${IVORY_SHADOW_MD}`;

/** Clinic calendar - deep navy panel. */
export const DOCTOR_CALENDAR_BG = "#1E1B31";
export const DOCTOR_CALENDAR_SURFACE = "#242A5F";
export const DOCTOR_CALENDAR_ACCENT = DOCTOR_NAVY;
export const DOCTOR_CALENDAR_ACCENT_MID = "#5B66A1";
export const DOCTOR_CALENDAR_IVORY = DOCTOR_IVORY_TILE;

/** @deprecated use DOCTOR_CALENDAR_BG */
export const DOCTOR_IVORY_CALENDAR_PANEL = DOCTOR_CALENDAR_BG;

export const doctorCalendarPanelClass =
  "rounded-2xl bg-[#1E1B31] text-zinc-100 shadow-[0_4px_20px_rgba(26,35,66,0.35),0_12px_32px_rgba(26,35,66,0.25)]";

/** Patient grid tile / list row on patients panel. */
export const doctorPatientTileClass =
  `rounded-2xl border border-white/60 bg-white/65 ${IVORY_SHADOW_SM} transition hover:border-white/80 hover:bg-white/78 hover:shadow-[0_2px_8px_rgba(72,64,48,0.07)]`;

export const doctorPatientTileUrgentClass =
  "rounded-2xl border border-rose-100/80 bg-white/65 shadow-[0_1px_3px_rgba(120,72,64,0.08)] ring-1 ring-rose-200/70 transition hover:border-rose-50 hover:bg-white/78 hover:shadow-[0_2px_8px_rgba(120,72,64,0.09)]";

export const doctorPatientListRowClass =
  `rounded-xl border border-white/55 bg-white/62 ${IVORY_SHADOW_SM} transition hover:border-white/75 hover:bg-white/75 hover:shadow-[0_2px_6px_rgba(72,64,48,0.06)]`;

export const doctorPatientListRowUrgentClass =
  "rounded-xl border border-rose-100/80 bg-white/62 shadow-[0_1px_3px_rgba(120,72,64,0.07)] ring-1 ring-rose-200/65 transition hover:border-rose-50 hover:bg-white/75";

/** Search / filters inside patients panel. */
export const doctorIvoryFieldClass =
  `rounded-xl border border-[#1E1B31] bg-[#DBDAD2] ${IVORY_SHADOW_SM} text-[#1E1B31] placeholder:text-[#1E1B31]/55`;

export const doctorIvoryToggleShellClass =
  "inline-flex rounded-lg bg-[#DBDAD2] p-0.5 shadow-[inset_0_1px_3px_rgba(72,64,48,0.10)]";

export const doctorIvoryToggleOnClass =
  "bg-[#F2E9D8] text-slate-800 shadow-[0_1px_2px_rgba(72,64,48,0.08)]";

export const doctorPortalShellClass =
  "min-h-screen bg-[#FAF8F5] bg-gradient-to-b from-[#F0EAE2] via-[#FAF8F5] to-[#FAF8F5]";

/** Compact header icon buttons - icon-only on mobile, label from sm+. */
export const doctorHeaderBellBtnClass =
  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2";

/** Top portal bar - mostly opaque so header controls stay readable. */
export const doctorGlassHeaderClass =
  "border-b border-slate-200/70 bg-[#FAF8F5]/90 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-md";

/** Sticky in-page tab strip - no extra card behind tab buttons. */
export const doctorStickyTabsClass =
  "sticky z-10 border-b border-[#1E1B31]/10 pb-3 pt-1";

export const doctorGlassSidebarClass =
  "border-r border-slate-200/60 bg-[#FAF8F5]/88 backdrop-blur-md";

/** Main content cards on ivory shell (patient detail, etc.). */
export const doctorCardClass =
  `rounded-2xl bg-[#E8E7DE] ${IVORY_SHADOW_MD}`;

/** Patient detail hero header - flat navy shell, white stat tiles inside. */
export const doctorPatientHeaderClass = "rounded-2xl bg-[#1E1B31] text-white";

/** Patient detail overview tabs - outer container (~5.5% darker than page ivory). */
export const DOCTOR_PATIENT_PAGE_BG = DOCTOR_IVORY_PATIENTS_PANEL;
/** @deprecated use DOCTOR_PATIENT_PAGE_BG */
export const DOCTOR_SCHEDULE_PAGE_BG = DOCTOR_PATIENT_PAGE_BG;

export const doctorPatientPageCardClass =
  `rounded-2xl bg-[#E8E7DE] ${IVORY_SHADOW_MD}`;
/** @deprecated use doctorPatientPageCardClass */
export const doctorSchedulePageCardClass = doctorPatientPageCardClass;

/** Nested panels inside main cards. */
export const doctorCardMutedClass =
  `rounded-xl bg-[#DBDAD2] ${IVORY_SHADOW_SM}`;

/** Stat / metric tile inside patient detail cards. */
export const doctorDetailStatClass =
  "rounded-xl bg-white/95 p-3 shadow-[0_1px_2px_rgba(72,64,48,0.06),0_2px_8px_rgba(72,64,48,0.05)]";

const SCHEDULE_WHITE_LIFT =
  "shadow-[0_2px_10px_rgba(72,64,48,0.12),0_6px_20px_rgba(72,64,48,0.08)]";

/** Solid white inset panels on patient detail overview tabs. */
export const doctorPatientPagePanelClass =
  `rounded-xl bg-white ${SCHEDULE_WHITE_LIFT}`;
/** @deprecated use doctorPatientPagePanelClass */
export const doctorSchedulePanelClass = doctorPatientPagePanelClass;

const NAVY_PANEL_SHADOW =
  "shadow-[0_4px_20px_rgba(26,35,66,0.28),0_8px_24px_rgba(30, 27, 49,0.18)]";

/** Navy panels (routine tab, etc.) - less white, portal accent. */
export const doctorPatientPageNavyPanelClass =
  `rounded-xl bg-[#1E1B31] text-white ${NAVY_PANEL_SHADOW}`;

export const doctorPatientPageNavyInsetClass = "rounded-lg bg-[#242A5F] p-2";

export const doctorPatientPageNavyRowClass = "rounded-md bg-[#354878]/55";

/** Primary action on navy panels - ivory pill. */
export const doctorPatientPageNavyBtnPrimaryClass =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#F2E9D8] px-2.5 text-xs font-semibold text-[#1E1B31] transition hover:bg-white disabled:opacity-50";

/** Secondary action on navy panels. */
export const doctorPatientPageNavyBtnGhostClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50";

/** Light navy tint inset on white patient-detail panels. */
export const doctorPatientPageAccentInsetClass = "rounded-lg bg-[#1E1B31]/8 p-2";

export const doctorPatientPageAccentRowClass = "rounded-md bg-[#FAF8F5]/70";

/** AM/PM routine columns - no outer border; divider sits between columns. */
export const doctorRoutineAmPmColumnClass = "min-w-0 space-y-1.5";

/** Compact primary button (icon + label, no clipped text). */
export const doctorBtnPrimarySmClass =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1E1B31] px-3 py-2 text-xs font-semibold leading-normal text-white shadow-sm transition hover:bg-[#242A5F] disabled:opacity-50";

/** Secondary button on ivory / white panels. */
export const doctorPatientPageGhostBtnClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E1B31]/18 bg-white px-2.5 text-xs font-semibold text-[#1E1B31] transition hover:bg-[#FAF8F5] disabled:opacity-50";

/** Navy chip + white icon (visit notes form, history cards). */
export const doctorNavyIconChipClass =
  "flex shrink-0 items-center justify-center rounded-md bg-[#1E1B31] text-white";

export const doctorVisitNoteFieldIconShellClass =
  `mt-1.5 h-7 w-7 ${doctorNavyIconChipClass}`;

/** List rows on patient detail overview tabs. */
export const doctorPatientPageRowClass =
  `rounded-lg bg-white px-3 py-2.5 ${SCHEDULE_WHITE_LIFT}`;
/** @deprecated use doctorPatientPageRowClass */
export const doctorVisitRowClass = doctorPatientPageRowClass;

/** Empty / placeholder blocks on ivory panels. */
export const doctorEmptyStateClass =
  "rounded-xl border border-dashed border-[#1E1B31]/12 bg-[#DBDAD2]/50 text-center text-sm text-slate-600";

/** Floating menus (alerts, messages) - fully opaque over page content. */
export const doctorDropdownClass =
  "rounded-2xl border border-slate-200 bg-white shadow-lg";

export const doctorInsetStripClass =
  "border-t border-[#1E1B31]/10 bg-[#DBDAD2]/70";

export const doctorBtnPrimaryClass =
  "rounded-lg bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#242A5F] disabled:opacity-50";

export const doctorFormInputClass =
  "w-full rounded-lg bg-white/95 px-3 py-2 text-sm text-[#1E1B31] shadow-[0_1px_2px_rgba(72,64,48,0.06),0_2px_8px_rgba(72,64,48,0.05)] placeholder:text-[#1E1B31]/40 outline-none focus:ring-2 focus:ring-[#1E1B31]/20";

export const doctorFormInputSmClass =
  "w-full rounded bg-white/95 px-1 py-0.5 text-xs text-[#1E1B31] shadow-[0_1px_2px_rgba(72,64,48,0.05)] placeholder:text-[#1E1B31]/40 outline-none focus:ring-1 focus:ring-[#1E1B31]/20";

/** Pre-treatment form panel - navy accent on ivory stack. */
export const doctorPanelPreClass =
  `rounded-xl bg-[#1E1B31]/10 p-4 ${IVORY_SHADOW_SM}`;

/** Post-treatment form panel. */
export const doctorPanelPostClass =
  `rounded-xl bg-white/95 p-4 ${IVORY_SHADOW_SM}`;

"use client";

import type { ComponentType, ReactNode } from "react";
import {
  doctorCalendarPanelClass,
  doctorCardClass,
  doctorCardMutedClass,
  doctorPatientsPanelClass,
} from "@/src/lib/doctorPortalTheme";

export {
  DOCTOR_NAVY,
  DOCTOR_SAGE_FROM,
  DOCTOR_SAGE_MID,
  DOCTOR_SAGE_TO,
  DOCTOR_SAGE_GRADIENT,
  DOCTOR_BG,
  doctorPortalShellClass,
  doctorGlassHeaderClass,
  doctorStickyTabsClass,
  doctorGlassSidebarClass,
  doctorCardClass,
  doctorPatientHeaderClass,
  doctorPatientPageCardClass,
  doctorPatientPagePanelClass,
  doctorPatientPageNavyPanelClass,
  doctorPatientPageNavyInsetClass,
  doctorPatientPageNavyRowClass,
  doctorPatientPageNavyBtnPrimaryClass,
  doctorPatientPageNavyBtnGhostClass,
  doctorPatientPageAccentInsetClass,
  doctorPatientPageAccentRowClass,
  doctorRoutineAmPmColumnClass,
  doctorBtnPrimarySmClass,
  doctorPatientPageGhostBtnClass,
  doctorNavyIconChipClass,
  doctorVisitNoteFieldIconShellClass,
  doctorPatientPageRowClass,
  doctorPatientPageFormInputClass,
  DOCTOR_PATIENT_PAGE_BG,
  doctorSchedulePageCardClass,
  DOCTOR_SCHEDULE_PAGE_BG,
  doctorCardMutedClass,
  doctorDetailStatClass,
  doctorSchedulePanelClass,
  doctorScheduleFormInputClass,
  doctorVisitRowClass,
  doctorEmptyStateClass,
  doctorFormInputSmClass,
  doctorIvoryCardClass,
  doctorPatientsPanelClass,
  doctorCalendarPanelClass,
  doctorPatientTileClass,
  doctorPatientTileUrgentClass,
  doctorPatientListRowClass,
  doctorPatientListRowUrgentClass,
  doctorIvoryFieldClass,
  doctorIvoryFieldSoftClass,
  doctorIvoryToggleShellClass,
  doctorIvoryToggleOnClass,
  DOCTOR_IVORY_PATIENTS_PANEL,
  DOCTOR_IVORY_CALENDAR_PANEL,
  doctorDropdownClass,
  doctorInsetStripClass,
  doctorBtnPrimaryClass,
  doctorFormInputClass,
  doctorPanelPreClass,
  doctorPanelPostClass,
} from "@/src/lib/doctorPortalTheme";

export const DOCTOR_ICON_SM = "h-3.5 w-3.5 shrink-0";
export const DOCTOR_ICON_MD = "h-4 w-4 shrink-0";

export function DoctorIconBadge({
  icon: Icon,
  label,
  className = "",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <span
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${className}`}
    >
      <Icon className={DOCTOR_ICON_SM} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function DoctorIconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = "navy",
  className = "",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "navy" | "outline";
  className?: string;
}) {
  const styles =
    variant === "navy"
      ? "bg-[#2C3E6B] text-white hover:bg-[#243356]"
      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50 ${styles} ${className}`}
    >
      <Icon className={DOCTOR_ICON_MD} aria-hidden />
    </button>
  );
}

export function DoctorIconField({
  icon: Icon,
  label,
  children,
  className = "",
  iconShellClassName = "mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/55 text-[#2C3E6B]",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  className?: string;
  iconShellClassName?: string;
}) {
  return (
    <label className={`flex items-start gap-2 ${className}`}>
      <span title={label} className={iconShellClassName}>
        <Icon className={DOCTOR_ICON_SM} aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

export function DoctorIconDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2" title={label}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[#2C3E6B]">
        <Icon className={DOCTOR_ICON_SM} aria-hidden />
      </span>
      <div className="min-w-0">
        <span className="sr-only">{label}</span>
        <p className="text-xs font-medium leading-snug text-slate-800">{value}</p>
      </div>
    </div>
  );
}

/** Compact labeled field for patient summary strips (label above value). */
export function DoctorMetaCell({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium leading-snug text-slate-900">
        {value}
      </dd>
    </div>
  );
}

export function DoctorPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2C3E6B]/70">
          Staff portal
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function DoctorCard({
  children,
  className = "",
  as: Tag = "section",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  /** `patients` = lighter ivory panel; `calendar` = deeper ivory panel. */
  variant?: "default" | "patients" | "calendar";
}) {
  const shell =
    variant === "patients"
      ? doctorPatientsPanelClass
      : variant === "calendar"
        ? doctorCalendarPanelClass
        : doctorCardClass;

  return <Tag className={`${shell} ${className}`}>{children}</Tag>;
}

export function DoctorInlineLoader({
  label = "Loading…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const row = (
    <>
      <span
        className="inline-block shrink-0 animate-spin rounded-full border-2 border-[#2C3E6B] border-t-transparent"
        style={{ width: compact ? 14 : 16, height: compact ? 14 : 16 }}
        aria-hidden
      />
      <span>{label}</span>
    </>
  );

  if (compact) {
    return (
      <p
        className="flex items-center gap-2 text-sm text-slate-500"
        role="status"
        aria-live="polite"
      >
        {row}
      </p>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${doctorCardMutedClass} px-4 py-3 text-sm text-slate-600`}
      role="status"
      aria-live="polite"
    >
      {row}
    </div>
  );
}

export function DoctorSegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  size = "md",
  iconOnly = false,
  iconOnlyCompact = false,
}: {
  tabs: Array<{
    key: T;
    label: string;
    icon?: ComponentType<{ className?: string }>;
    description?: string;
  }>;
  active: T;
  onChange: (key: T) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  iconOnly?: boolean;
  iconOnlyCompact?: boolean;
}) {
  const pad = iconOnly
    ? size === "sm"
      ? "px-2 py-1.5"
      : "px-2.5 py-2"
    : size === "sm"
      ? "px-3 py-2 text-xs"
      : "px-4 py-2.5 text-sm";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-[1.125rem] w-[1.125rem]";

  return (
    <div
      className={`flex flex-wrap items-center gap-1 sm:flex-nowrap ${
        iconOnly && iconOnlyCompact
          ? "w-fit max-w-[32%] justify-start gap-2"
          : iconOnly
            ? "w-full gap-2"
            : "w-full"
      }`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            title={tab.label}
            onClick={() => onChange(tab.key)}
            className={`flex min-w-0 items-center justify-center rounded-lg font-semibold transition ${pad} ${
              iconOnly && iconOnlyCompact ? "flex-none" : "flex-1"
            } ${iconOnly ? "gap-0" : "gap-1.5"} ${
              isActive
                ? "bg-[#2C3E6B] text-white shadow-sm"
                : "text-slate-600 hover:bg-white/55 hover:text-slate-900"
            }`}
          >
            {Icon ? <Icon className={`${iconSize} shrink-0`} aria-hidden /> : null}
            {iconOnly ? (
              <span className="sr-only">{tab.label}</span>
            ) : (
              <span className="truncate">{tab.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function DoctorEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center border border-dashed border-white/50 ${doctorCardClass} px-6 py-14 text-center`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/60 text-slate-400">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

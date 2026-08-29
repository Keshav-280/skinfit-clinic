import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  patientGlassShell,
  patientKicker,
  patientMuted,
  patientSectionIcon,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";

export function DashboardPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className={`${patientGlassShell} px-6 py-6 text-center`}>
      <h1 className="text-2xl font-extrabold tracking-tight text-[#1E1B31] sm:text-3xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function DashboardPageSection({
  kicker,
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: {
  kicker?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${patientGlassShell} min-w-0 overflow-hidden p-5 md:p-6 ${className}`}>
      <div className="mb-5 flex gap-3">
        {Icon ? (
          <span className={patientSectionIcon} aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          {kicker ? <p className={patientKicker}>{kicker}</p> : null}
          <h2 className={patientSectionTitle}>{title}</h2>
          {description ? (
            <p className={`mt-1 max-w-xl ${patientMuted}`}>{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

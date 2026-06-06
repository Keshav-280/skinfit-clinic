import type { LucideIcon } from "lucide-react";

import { patientDashboardCard } from "@/src/lib/patientDashboardTheme";

export const DASHBOARD_SECTION_CARD = patientDashboardCard;

const NAVY = "#2D3E6B";

type Props = {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
  headingId?: string;
};

export function DashboardSectionHeader({
  icon: Icon,
  title,
  action,
  className = "mb-4",
  titleAs = "h2",
  headingId,
}: Props) {
  const TitleTag = titleAs;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white shadow-md"
          style={{ backgroundColor: NAVY }}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <TitleTag
          id={headingId}
          className="text-base font-extrabold tracking-wide text-[#2C3E6B] md:text-lg"
        >
          {title}
        </TitleTag>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

export const DASHBOARD_SECTION_CARD =
  "rounded-[22px] border border-white/70 bg-white/40 p-5 shadow-[0_8px_30px_rgba(44,62,107,0.06)] backdrop-blur-sm md:p-6";

const NAVY = "#2C3E6B";

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

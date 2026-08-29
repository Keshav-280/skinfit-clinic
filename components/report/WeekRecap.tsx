import { REPORT_CARD, REPORT_PILL } from "./reportCopy";

type WeekRecapProps = {
  data: Array<{ label: string; value: string }>;
  highlight?: string | null;
  emptyMessage?: string;
};

export function WeekRecap({
  data,
  highlight,
  emptyMessage = "Complete your weekly check-in to see habits here.",
}: WeekRecapProps) {
  const hasData = data.some((d) => d.value.trim() && d.value !== "—");

  return (
    <section className={`${REPORT_CARD} px-3.5 py-4`}>
      <div className="mb-3">
        <span className={REPORT_PILL}>Your week</span>
      </div>
      {!hasData ? (
        <p className="rounded-2xl bg-white/70 px-3.5 py-3 text-[13px] leading-[1.5] text-[#5B6478]">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {data.slice(0, 4).map((cell) => (
              <div
                key={cell.label}
                className="rounded-2xl bg-white/70 px-1.5 py-3 text-center"
              >
                <p className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#8B93A4]">
                  {cell.label}
                </p>
                <p className="text-[12px] font-bold leading-tight text-[#1A2035]">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>
          {highlight ? (
            <p className="mt-3 text-[12.5px] leading-[1.45] text-[#5B6478]">
              {highlight}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

type WeekRecapProps = {
  data: Array<{ label: string; value: string }>;
  highlight?: string | null;
  emptyMessage?: string;
};

export function WeekRecap({
  data,
  highlight,
  emptyMessage = "Complete your weekly check-in to see your habits tracked here.",
}: WeekRecapProps) {
  const hasData = data.some((d) => d.value.trim() && d.value !== "—");

  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <h2 className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
        Your week
      </h2>
      {!hasData ? (
        <p className="rounded-[12px] bg-kai-sage px-3.5 py-4 text-[12.5px] leading-[1.55] text-kai-ink-2">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[12px] bg-kai-rule">
            {data.slice(0, 4).map((cell) => (
              <div key={cell.label} className="bg-kai-sage px-2 py-3 text-center">
                <p className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-kai-ink-3">
                  {cell.label}
                </p>
                <p className="text-[12px] font-bold leading-tight text-kai-ink">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>
          {highlight ? (
            <p className="mt-3 text-[12px] leading-[1.5] text-kai-ink-2">
              {highlight}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

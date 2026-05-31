const CARD =
  "rounded-[22px] border border-white/70 bg-white/40 shadow-[0_8px_30px_rgba(44,62,107,0.06)] backdrop-blur-sm";

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-[#2C3E6B]/10 ${className}`} />;
}

function SectionSkeleton() {
  return (
    <section className={`${CARD} space-y-4 p-5 sm:p-6`}>
      <div className="space-y-2">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-5 w-40" />
        <Shimmer className="h-3.5 w-3/4" />
      </div>
      <div className="space-y-2.5">
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-5/6" />
        <Shimmer className="h-3.5 w-2/3" />
      </div>
    </section>
  );
}

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 pb-10 sm:px-0">
      <section className={`${CARD} flex flex-col items-center gap-2 px-6 py-6`}>
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-64" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[18px] border border-white/70 bg-white/45 px-3.5 py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-[11px] bg-[#2C3E6B]/20" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Shimmer className="h-2.5 w-16" />
                      <Shimmer className="h-3.5 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
        <div className="space-y-6">
          <SectionSkeleton />
        </div>
      </div>
    </div>
  );
}

export default function HistoryLoading() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <p className="text-2xl font-extrabold tracking-tight text-[#2C3E6B]">
          Assembling your timeline
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-[#6B7280]">
          kAI is pulling your progress, visits, and care notes.
        </p>

        <div className="mt-2 h-1 w-full max-w-[280px] overflow-hidden rounded-full bg-[#2C3E6B]/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-[#2C3E6B]/50" />
        </div>
      </div>
    </div>
  );
}

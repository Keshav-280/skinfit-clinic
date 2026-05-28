export default function HistoryLoading() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            className="absolute inset-0 animate-pulse rounded-full border border-teal-200/80 bg-[#2C3E6B]/[0.06]"
            aria-hidden
          />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-teal-50 via-white to-[#2C3E6B]/10 shadow-[0_12px_28px_-14px_rgba(44,62,107,0.45)]">
            <svg
              className="h-11 w-11 animate-pulse text-[#2C3E6B]"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M7.5 5.6L10 7l-2.2 3.8-1.3-1.8L7.5 5.6zm9 0L14 7l2.2 3.8 1.3-1.8-1-3.4zM12 2l1.2 3.4h3.5L14 7.5l1.2 3.4L12 9.2 8.8 10.9 10 7.5 7.3 5.4h3.5L12 2zM5 13l1.8 3.1-3.1.9L5 19.5l-1.3-2.5-3.1.9L3.2 15 5 13zm14 0l1.8 2-1.3 2.5 3.1-.9L19 16.1 17.2 13zm-7 4.5l2.2 3.8 2.2-3.8L12 22l-2-4.5z" />
            </svg>
          </span>
        </div>

        <p className="text-2xl font-extrabold tracking-tight text-[#2C3E6B]">
          Assembling your timeline
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-zinc-600">
          kAI is pulling your progress, visits, and care notes.
        </p>

        <p className="text-sm font-semibold text-teal-700">Scan reports</p>

        <div className="mt-2 h-1 w-full max-w-[280px] overflow-hidden rounded-full bg-[#2C3E6B]/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-teal-600/70" />
        </div>
      </div>
    </div>
  );
}

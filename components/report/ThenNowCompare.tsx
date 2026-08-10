type ThenNowCompareProps = {
  previousImage: { url: string; date: string };
  currentImage: { url: string; date: string };
  caption?: string;
};

export function ThenNowCompare({
  previousImage,
  currentImage,
  caption = "Both captures passed quality checks, so this comparison is reliable.",
}: ThenNowCompareProps) {
  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <div className="mb-[15px] flex items-baseline justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
          Then / now
        </h2>
      </div>
      <div className="relative mb-3 aspect-[16/11] overflow-hidden rounded-[14px] bg-kai-sage-2">
        <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previousImage.url}
            alt={`Previous scan ${previousImage.date}`}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-2.5 left-2.5 rounded bg-black/45 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
            {previousImage.date}
          </span>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage.url}
            alt={`Current scan ${currentImage.date}`}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-2.5 right-2.5 rounded bg-black/45 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
            {currentImage.date}
          </span>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-kai-navy shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          aria-hidden
        >
          <span className="text-[10px] font-bold tracking-tight text-white">
            ↔
          </span>
        </div>
      </div>
      <p className="text-[11.5px] leading-[1.45] text-kai-ink-3">{caption}</p>
    </section>
  );
}

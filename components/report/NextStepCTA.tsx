import Link from "next/link";

type NextStepCTAProps = {
  heading: string;
  body: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
};

export function NextStepCTA({
  heading,
  body,
  primaryAction,
  secondaryAction,
}: NextStepCTAProps) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[#1E1B31] px-5 py-5 text-white shadow-[0_22px_50px_-18px_rgba(30, 27, 49,0.65)]">
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-[#C4A056]/20"
        aria-hidden
      />
      <p className="relative mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">
        Next step
      </p>
      <h2 className="relative mb-1.5 text-[18px] font-semibold leading-snug tracking-[-0.02em]">
        {heading}
      </h2>
      <p className="relative mb-4 line-clamp-3 text-[12.5px] leading-[1.45] text-white/65">
        {body}
      </p>
      <Link
        href={primaryAction.href}
        className="report-shine relative block overflow-hidden rounded-2xl bg-white py-3.5 text-center text-[14px] font-semibold text-[#1E1B31]"
      >
        {primaryAction.label}
      </Link>
      {secondaryAction ? (
        <Link
          href={secondaryAction.href}
          className="relative mt-2 block py-2 text-center text-[13px] font-semibold text-white/80"
        >
          {secondaryAction.label}
        </Link>
      ) : null}
    </section>
  );
}

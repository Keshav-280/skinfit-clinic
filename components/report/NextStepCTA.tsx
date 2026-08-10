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
    <section className="bg-kai-navy px-6 py-6 text-white">
      <p className="mb-[9px] text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
        Next step
      </p>
      <h2 className="mb-[7px] font-serif text-[19px] font-light leading-[1.3] tracking-[-0.005em]">
        {heading}
      </h2>
      <p className="mb-[17px] text-xs leading-[1.55] text-white/60">{body}</p>
      <Link
        href={primaryAction.href}
        className="block rounded-[11px] bg-white py-3.5 text-center text-[13.5px] font-semibold text-kai-navy"
      >
        {primaryAction.label}
      </Link>
      {secondaryAction ? (
        <Link
          href={secondaryAction.href}
          className="mt-[9px] block rounded-[11px] border border-white/30 bg-transparent py-3.5 text-center text-[13.5px] font-semibold text-white"
        >
          {secondaryAction.label}
        </Link>
      ) : null}
    </section>
  );
}

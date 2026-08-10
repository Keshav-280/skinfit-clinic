type ActionItemProps = {
  number: number;
  text: string;
};

export function ActionItem({ number, text }: ActionItemProps) {
  return (
    <div className="flex gap-[11px] border-b border-kai-rule py-3 last:border-b-0 last:pb-0">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kai-navy text-[10px] font-bold text-white">
        {number}
      </span>
      <p className="text-[12.5px] leading-[1.55] text-kai-ink-2">{text}</p>
    </div>
  );
}

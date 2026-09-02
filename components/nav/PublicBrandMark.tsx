import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  /** Dark backgrounds invert the wordmark to white. */
  invert?: boolean;
  className?: string;
};

/** Public wordmark - isolation space lives in the link padding. Never SF. */
export function PublicBrandMark({
  href = "/",
  invert = false,
  className = "",
}: Props) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center p-2 ${className}`}
      aria-label="SkinFit Wellness - home"
    >
      <Image
        src="/branding/skinfit-wellness-logo.svg"
        alt="SkinFit Wellness"
        width={560}
        height={135}
        priority
        className={`h-8 w-auto max-w-[11rem] object-contain object-left sm:h-9 sm:max-w-[13rem] ${
          invert ? "brightness-0 invert" : ""
        }`}
      />
    </Link>
  );
}

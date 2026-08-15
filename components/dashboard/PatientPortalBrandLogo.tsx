import Image from "next/image";
import Link from "next/link";

type Props = {
  className?: string;
};

/** Patient dashboard navbar brand — keep height within existing header (h-8). */
export function PatientPortalBrandLogo({ className = "" }: Props) {
  return (
    <Link
      href="/dashboard"
      className={`inline-flex shrink-0 items-center transition-opacity hover:opacity-75 ${className}`}
      aria-label="SkinFit Wellness — dashboard home"
    >
      <Image
        src="/branding/skinfit-wellness-logo.svg"
        alt="SkinFit Wellness"
        width={560}
        height={135}
        priority
        className="h-8 w-auto max-w-[11rem] object-contain object-left sm:max-w-[12rem]"
      />
    </Link>
  );
}

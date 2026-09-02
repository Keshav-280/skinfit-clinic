import Image from "next/image";
import Link from "next/link";

type Props = {
  className?: string;
};

/** Navbar brand mark - SVG for crisp rendering at all sizes. */
export function DoctorPortalBrandLogo({ className = "" }: Props) {
  return (
    <Link
      href="/doctor/patients"
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label="SkinFit Wellness - doctor portal home"
    >
      <Image
        src="/branding/skinfit-wellness-logo.svg"
        alt="SkinFit Wellness"
        width={560}
        height={135}
        priority
        className="h-6 w-auto max-w-[6rem] object-contain object-left sm:h-8 sm:max-w-[11rem]"
      />
    </Link>
  );
}

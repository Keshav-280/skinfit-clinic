import Image from "next/image";
import Link from "next/link";

type Props = {
  className?: string;
};

/** Navbar brand mark — no background panel; transparent PNG works best on light headers. */
export function DoctorPortalBrandLogo({ className = "" }: Props) {
  return (
    <Link
      href="/doctor/patients"
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label="SkinFit Wellness — doctor portal home"
    >
      <Image
        src="/branding/skinfit-doctor-logo.png"
        alt="SkinFit Wellness"
        width={248}
        height={54}
        priority
        className="h-7 w-auto max-w-[9.5rem] object-contain object-left sm:h-8 sm:max-w-[11rem]"
      />
    </Link>
  );
}

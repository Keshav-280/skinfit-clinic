import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Early Access — SkinFit Wellness",
  description:
    "Register for early access to SkinFit Wellness and be notified when the app launches.",
  openGraph: {
    title: "Early Access — SkinFit Wellness",
    description:
      "Register for early access to SkinFit Wellness.",
  },
};

export default function PreReleaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-pre-release-shell
      className="min-h-dvh bg-[#D6E4D0] bg-gradient-to-b from-[#D6E4D0] via-[#E0EADA] to-[#EAF0E6] text-[#1F2A44] [color-scheme:light]"
    >
      {children}
    </div>
  );
}

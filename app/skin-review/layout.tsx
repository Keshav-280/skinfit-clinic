import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SkinReviewSignOut } from "@/components/skinReview/SkinReviewSignOut";
import { isReviewSignedIn } from "@/src/lib/skinReview/auth";

export const metadata: Metadata = {
  title: "Skin review | SkinFit Wellness",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SkinReviewLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isReviewSignedIn();
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="flex items-center gap-3 bg-[#1E1B31] px-4 py-2.5">
        <Link href="/skin-review" aria-label="SkinFit Wellness">
          <Image src="/branding/skinfit-wellness-logo.svg" alt="SkinFit Wellness" width={560} height={135} priority className="h-7 w-auto brightness-0 invert" />
        </Link>
        <span className="text-sm font-semibold text-[#AEB9E8]">Skin review</span>
        <span className="ml-auto">{signedIn ? <SkinReviewSignOut /> : null}</span>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}

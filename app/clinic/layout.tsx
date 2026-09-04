import { Inter } from "next/font/google";
import { doctorFontFamily } from "@/src/lib/doctorFonts";

const clinicInter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function ClinicRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-clinic-shell
      className={`${clinicInter.className} ${clinicInter.variable} min-h-screen antialiased text-slate-900`}
      style={{ fontFamily: doctorFontFamily }}
    >
      {children}
    </div>
  );
}

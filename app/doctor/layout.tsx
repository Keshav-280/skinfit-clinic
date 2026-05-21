import { Inter } from "next/font/google";
import { doctorFontFamily } from "@/src/lib/doctorFonts";

const doctorInter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function DoctorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-doctor-shell
      className={`${doctorInter.className} ${doctorInter.variable} min-h-screen antialiased text-slate-900`}
      style={{ fontFamily: doctorFontFamily }}
    >
      {children}
    </div>
  );
}

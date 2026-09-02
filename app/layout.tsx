import type { Metadata, Viewport } from "next";
import {
  Barlow_Condensed,
  Birthstone,
  Inter,
  Noto_Serif,
  Tenor_Sans,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-serif",
});

const tenor = Tenor_Sans({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-tenor",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

const birthstone = Birthstone({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-birthstone",
});

export const metadata: Metadata = {
  title: "SkinFit Wellness",
  description: "Clinical indigo, softened by rose - AI-guided skin care with your doctor.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SkinFit",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E1B31",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${notoSerif.variable} ${tenor.variable} ${barlow.variable} ${birthstone.variable} ${inter.className} antialiased bg-[#FAF8F5] text-[#1E1B31]`}
      >
        {children}
      </body>
    </html>
  );
}

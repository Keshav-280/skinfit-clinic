import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "../ui/Button";
import { PublicBrandMark } from "./PublicBrandMark";

const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E6F0] bg-[#FAF8F5]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <PublicBrandMark />

        <nav className="hidden items-center gap-6 text-sm font-medium text-[#1E1B31] md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-[#242A5F]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" className="hidden md:inline-flex">
            Login
          </Button>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E6F0] bg-white text-[#1E1B31] hover:bg-[#F0EAE2] md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

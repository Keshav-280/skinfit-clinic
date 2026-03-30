import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "../ui/Button";

const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
            SF
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-900">
              SkinnFit Clinic
            </span>
            <span className="text-xs text-slate-500">
              Skin · Aesthetics · Wellness
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-teal-600"
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}


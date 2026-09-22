import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/#practices", label: "For practices" },
  { href: "/#locums", label: "For locums" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faqs", label: "FAQs" },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-[70px] max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
            <span className="h-3.5 w-3.5 rotate-12 rounded-[3px] bg-amber" aria-hidden />
            Brighttemp
          </Link>
          <nav className="ml-auto hidden gap-6 text-sm font-medium md:flex">
            {NAV.map((i) => (
              <Link key={i.href} href={i.href} className="text-muted hover:text-pine">
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-pine">
              Log in
            </Link>
            <Link href="/register/practice" className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-white">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-[#082926] px-6 py-16 text-[#A9C7C1]">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xl font-extrabold text-white">
              <span className="h-3.5 w-3.5 rotate-12 rounded-[3px] bg-amber" aria-hidden />
              Brighttemp
            </p>
            <p className="max-w-[32ch] text-sm">
              Dental locum cover, booked direct. Locums keep their rate. Practices pay one flat fee.
            </p>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Practices</h2>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/register/practice">Register</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/faqs">FAQs</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Locums</h2>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/register/locum">Join free</Link></li>
              <li><Link href="/#compliance">Compliance</Link></li>
              <li><Link href="/faqs">FAQs</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Contact</h2>
            <ul className="space-y-1.5 text-sm">
              <li><a href="mailto:hello@brighttemp.co.uk">hello@brighttemp.co.uk</a></li>
              <li>Mon–Fri, 8am–6pm</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-sm">
          © {new Date().getFullYear()} Brighttemp Ltd. Registered in England &amp; Wales.
        </p>
      </footer>
    </div>
  );
}

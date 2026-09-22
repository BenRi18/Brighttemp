import Link from "next/link";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string };

export function PortalShell({
  nav,
  name,
  context,
  children,
}: {
  nav: NavItem[];
  name: string;
  context?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[70px] max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span className="h-3.5 w-3.5 rotate-12 rounded-[3px] bg-amber" aria-hidden />
            Brighttemp
          </Link>
          <nav className="ml-auto hidden gap-5 text-sm font-medium md:flex">
            {nav.map((i) => (
              <Link key={i.href} href={i.href} className="text-muted hover:text-pine">
                {i.label}
              </Link>
            ))}
          </nav>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="text-sm text-muted underline">
              Sign out
            </button>
          </form>
        </div>
        <div className="border-t border-line bg-paper">
          <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-6 py-2 text-sm">
            <span className="font-semibold">{name}</span>
            {context ? <span className="text-muted">{context}</span> : null}
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-line bg-white px-6 py-2 text-sm md:hidden">
          {nav.map((i) => (
            <Link key={i.href} href={i.href} className="whitespace-nowrap text-muted">
              {i.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

export function PageHeading({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      {lede ? <p className="mt-2 text-muted">{lede}</p> : null}
    </div>
  );
}

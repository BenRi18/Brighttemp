import { requirePractice } from "@/features/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

const NAV = [
  { href: "/practice", label: "Dashboard" },
  { href: "/practice/search", label: "Find cover" },
  { href: "/practice/bookings", label: "Bookings" },
  { href: "/practice/favourites", label: "Favourites" },
  { href: "/practice/invoices", label: "Invoices" },
  { href: "/practice/settings", label: "Settings" },
];

/** The gate runs once here, so every page below can assume an approved practice. */
export default async function PracticeLayout({ children }: { children: React.ReactNode }) {
  const { practice } = await requirePractice();
  return (
    <PortalShell
      nav={NAV}
      name={practice.practice.name}
      context={practice.practice.trust_level === "trusted" ? "Instant booking enabled" : undefined}
    >
      {children}
    </PortalShell>
  );
}

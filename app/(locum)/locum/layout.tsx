import { requireLocum } from "@/features/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

const NAV = [
  { href: "/locum", label: "Shifts" },
  { href: "/locum/availability", label: "Availability" },
  { href: "/locum/compliance", label: "Documents" },
  { href: "/locum/rates", label: "Rates" },
  { href: "/locum/settings", label: "Profile" },
];

export default async function LocumLayout({ children }: { children: React.ReactNode }) {
  const { locum, profile } = await requireLocum();
  return (
    <PortalShell
      nav={NAV}
      name={profile.full_name}
      context={
        locum.is_bookable
          ? "Visible in search"
          : locum.status === "approved"
            ? "Hidden — documents outstanding"
            : "Awaiting approval"
      }
    >
      {children}
    </PortalShell>
  );
}

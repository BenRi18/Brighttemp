import { requireAdmin } from "@/features/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/compliance", label: "Documents" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/fees", label: "Fees" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, profile } = await requireAdmin();
  return (
    <PortalShell nav={NAV} name={profile.full_name} context={admin.admin_role.replace("_", " ")}>
      {children}
    </PortalShell>
  );
}

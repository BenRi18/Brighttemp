import Link from "next/link";
import { adminStats, expiringDocuments } from "@/features/admin/queries";
import { PageHeading } from "@/components/layout/portal-shell";
import { DOC_LABELS } from "@/features/compliance/schema";

export default async function AdminOverview() {
  const [stats, expiring] = await Promise.all([adminStats(), expiringDocuments(30)]);

  const tiles = [
    { label: "Practices to approve", value: stats.pendingPractices, href: "/admin/approvals" },
    { label: "Locums to approve", value: stats.pendingLocums, href: "/admin/approvals" },
    { label: "Documents to review", value: stats.pendingDocuments, href: "/admin/compliance" },
    { label: "Shifts today", value: stats.bookingsToday, href: "/admin/bookings" },
    { label: "Unpaid invoices", value: stats.unpaidInvoices, href: "/admin/invoices" },
  ];

  return (
    <>
      <PageHeading title="Overview" />

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded-xl border border-line bg-white p-5 hover:border-pine"
          >
            <p className="text-3xl font-extrabold tracking-tight">{t.value}</p>
            <p className="mt-1 text-sm text-muted">{t.label}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-1 font-bold">Expiring within 30 days</h2>
        <p className="mb-4 text-sm text-muted">
          Chase these before they lapse — expiry removes the locum from search automatically.
        </p>
        {expiring.length === 0 ? (
          <p className="text-muted">Nothing expiring.</p>
        ) : (
          <ul className="divide-y divide-line">
            {expiring.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="flex-1 font-medium">
                  {d.locums?.profiles?.full_name}
                </span>
                <span className="text-muted">{DOC_LABELS[d.doc_type]}</span>
                <span className="font-semibold">
                  {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("en-GB") : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

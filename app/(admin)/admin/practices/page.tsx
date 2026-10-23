import Link from "next/link";
import { listPractices, ACCOUNT_STATUSES } from "@/features/admin/queries";
import { PageHeading } from "@/components/layout/portal-shell";
import { AccountBadge, Badge } from "@/components/ui/badge";
import type { AccountStatus } from "@/lib/database.types";

export const metadata = { title: "Practices — Brighttemp admin" };

type Search = { q?: string; status?: string; trust?: string };

/**
 * The practice roster. Approvals handles the queue; this is the book of
 * everyone signed up, for looking a practice up afterwards.
 */
export default async function AdminPracticesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const { rows, truncated } = await listPractices({
    q: sp.q,
    status: sp.status,
    trustLevel: sp.trust,
  });

  const filtered = Boolean(sp.q || sp.status || sp.trust);
  const trusted = rows.filter((r) => r.trustLevel === "trusted").length;
  const owing = rows.filter((r) => r.unpaidInvoices > 0).length;

  const select =
    "rounded-lg border border-line bg-white px-3 py-2 text-sm text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-amber";

  return (
    <>
      <PageHeading
        title="Practices"
        lede="Everyone registered, whatever their status. Search by name, email, town or postcode."
      />

      <form className="mb-6 flex flex-wrap gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Name, email, town or postcode"
          aria-label="Search practices"
          className="min-w-[16rem] flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber"
        />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={select}>
          <option value="">Any status</option>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          name="trust"
          defaultValue={sp.trust ?? ""}
          aria-label="Booking permission"
          className={select}
        >
          <option value="">Any booking permission</option>
          <option value="trusted">Instant booking</option>
          <option value="new">Needs locum approval</option>
        </select>
        <button className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white">
          Apply
        </button>
        {filtered ? (
          <Link
            href="/admin/practices"
            className="self-center text-sm font-semibold text-muted underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <p className="mb-4 text-sm text-muted">
        {rows.length} {rows.length === 1 ? "practice" : "practices"}
        {rows.length > 0 ? ` · ${trusted} can book instantly` : ""}
        {owing > 0 ? ` · ${owing} with unpaid invoices` : ""}
        {truncated ? " · showing the first 500, narrow the filters to see more" : ""}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-5 py-8 text-center text-muted">
          {filtered ? "No practice matches those filters." : "No practice has registered yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="bg-[#EAF0EA] text-left text-muted">
                <th className="px-4 py-3 font-semibold">Practice</th>
                <th className="px-4 py-3 font-semibold">Where</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Booking</th>
                <th className="px-4 py-3 font-semibold">Bookings</th>
                <th className="px-4 py-3 font-semibold">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/practices/${r.id}`} className="font-semibold underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.tradingName && r.tradingName !== r.name ? `${r.tradingName} · ` : ""}
                      {r.email ?? "no email"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.city}
                    <div className="text-xs text-muted">{r.postcode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AccountBadge status={r.status as AccountStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {r.trustLevel === "trusted" ? (
                      <Badge tone="mint">Instant</Badge>
                    ) : (
                      <Badge tone="neutral">Needs approval</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.bookingCount}
                    <div className="text-xs text-muted">
                      {r.userCount} {r.userCount === 1 ? "user" : "users"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.unpaidInvoices > 0 ? (
                      <Badge tone="amber">{r.unpaidInvoices} unpaid</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

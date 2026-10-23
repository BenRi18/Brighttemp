import Link from "next/link";
import { notFound } from "next/navigation";
import {
  practiceRecord,
  practiceTeam,
  practiceBookings,
  practiceInvoices,
} from "@/features/admin/queries";
import { ApprovalRow } from "@/features/admin/components/approval-row";
import { TrustToggle } from "@/features/admin/components/trust-toggle";
import { PageHeading } from "@/components/layout/portal-shell";
import { AccountBadge, Badge, BookingBadge } from "@/components/ui/badge";
import { money, shiftDate, shiftTimes, stampDate } from "@/lib/format";
import type { AccountStatus, BookingStatus } from "@/lib/database.types";

export const metadata = { title: "Practice record — Brighttemp admin" };

const INVOICE_TONE: Record<string, "neutral" | "amber" | "mint" | "red"> = {
  draft: "neutral",
  sent: "amber",
  paid: "mint",
  overdue: "red",
  cancelled: "neutral",
};

export default async function PracticeRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await practiceRecord(id);
  if (!practice) notFound();

  const [team, bookings, invoices] = await Promise.all([
    practiceTeam(practice.id),
    practiceBookings(practice.id),
    practiceInvoices(practice.id),
  ]);

  const address = [
    practice.address_line1,
    practice.address_line2,
    practice.city,
    practice.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Link href="/admin/practices" className="mb-4 inline-block text-sm text-muted underline">
        ← All practices
      </Link>

      <PageHeading title={practice.name} lede={address} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <AccountBadge status={practice.status as AccountStatus} />
        {practice.trust_level === "trusted" ? (
          <Badge tone="mint">Instant booking</Badge>
        ) : (
          <Badge tone="neutral">Bookings need locum approval</Badge>
        )}
      </div>

      {practice.suspension_reason ? (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Reason on file: {practice.suspension_reason}
        </p>
      ) : null}

      {practice.status === "pending" ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Waiting on a decision</h2>
          <ApprovalRow
            id={practice.id}
            kind="practice"
            title={practice.name}
            subtitle={`${practice.city}, ${practice.postcode}${
              practice.email ? ` · ${practice.email}` : ""
            }`}
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Practice">
          <Row label="Name" value={practice.name} />
          {practice.trading_name && practice.trading_name !== practice.name ? (
            <Row label="Trading as" value={practice.trading_name} />
          ) : null}
          <Row label="Address" value={address} />
          <Row
            label="Email"
            value={practice.email ?? "—"}
            href={practice.email ? `mailto:${practice.email}` : undefined}
          />
          <Row
            label="Phone"
            value={practice.phone ?? "—"}
            href={practice.phone ? `tel:${practice.phone}` : undefined}
          />
          {practice.cqc_provider_id ? (
            <Row label="CQC provider" value={practice.cqc_provider_id} />
          ) : null}
          <Row label="Registered" value={stampDate(practice.created_at)} />
          {practice.approved_at ? (
            <Row label="Approved" value={stampDate(practice.approved_at)} />
          ) : null}
        </Panel>

        <Panel title="Billing">
          <Row label="Invoices to" value={practice.billing_email ?? practice.email ?? "—"} />
          {practice.billing_address ? (
            <Row label="Billing address" value={practice.billing_address} />
          ) : null}
          <Row label="VAT number" value={practice.vat_number ?? "—"} />
          <Row label="Payment terms" value={`${practice.payment_terms_days} days`} />
          <Row
            label="PO required"
            value={practice.purchase_order_required ? "Yes" : "No"}
          />
        </Panel>
      </div>

      {practice.status === "approved" ? (
        <section className="mt-6">
          <TrustToggle practiceId={practice.id} trustLevel={practice.trust_level} />
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Who can sign in ({team.length})</h2>
        {team.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-muted">
            Nobody is attached to this practice yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[32rem] text-sm">
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{m.profiles?.full_name ?? "Unnamed"}</span>
                      {m.is_primary ? (
                        <span className="ml-2">
                          <Badge tone="pine">Main contact</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted">{m.role}</td>
                    <td className="px-4 py-3">
                      {m.profiles?.email ? (
                        <a href={`mailto:${m.profiles.email}`} className="underline">
                          {m.profiles.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {m.accepted_at ? "Active" : "Invited"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">Recent bookings</h2>
          {bookings.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-muted">
              No bookings yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        {shiftDate(b.booking_date)}
                        <div className="text-xs text-muted">
                          {shiftTimes(b.start_time, b.finish_time)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {b.locums?.profiles?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <BookingBadge status={b.status as BookingStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-muted">
              Nothing invoiced yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        {i.invoice_number}
                        <div className="text-xs text-muted">
                          Due {shiftDate(i.due_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{money(i.total)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={INVOICE_TONE[i.status] ?? "neutral"}>{i.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex gap-3 border-b border-line py-2 text-sm last:border-0">
      <span className="w-36 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-words font-medium">
        {href ? (
          <a href={href} className="underline">
            {value}
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

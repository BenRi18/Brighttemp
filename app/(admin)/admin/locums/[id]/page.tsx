import Link from "next/link";
import { notFound } from "next/navigation";
import { locumRecord, locumBookings, listRates } from "@/features/locums/queries";
import { complianceChecklist } from "@/features/compliance/queries";
import { ApprovalRow } from "@/features/admin/components/approval-row";
import { PageHeading } from "@/components/layout/portal-shell";
import { AccountBadge, Badge, BookingBadge, DocumentBadge } from "@/components/ui/badge";
import { hourly, shiftDate, shiftTimes, stampDate } from "@/lib/format";
import type { AccountStatus, BookingStatus } from "@/lib/database.types";

export const metadata = { title: "Locum record — Brighttemp admin" };

export default async function LocumRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locum = await locumRecord(id);
  if (!locum) notFound();

  // A finance admin can't read compliance documents — the RLS policy limits
  // them to super_admin, operations and compliance. An empty checklist here
  // means "not your remit", not "nothing uploaded", so it is labelled as such.
  const [checklist, rates, bookings] = await Promise.all([
    complianceChecklist(locum.id, locum.role_id),
    listRates(locum.id),
    locumBookings(locum.id),
  ]);

  const name = locum.profiles?.full_name ?? "Unnamed";
  const outstanding = checklist.filter(
    (r) => r.mandatory && (!r.document || !["approved", "expiring_soon"].includes(r.document.status)),
  );

  return (
    <>
      <Link href="/admin/locums" className="mb-4 inline-block text-sm text-muted underline">
        ← All locums
      </Link>

      <PageHeading
        title={name}
        lede={`${locum.roles?.name ?? "—"} · ${locum.years_experience} years · ${locum.base_postcode}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <AccountBadge status={locum.status as AccountStatus} />
        {locum.is_bookable ? (
          <Badge tone="mint">In practice search</Badge>
        ) : (
          <Badge tone="neutral">Not in search</Badge>
        )}
        {locum.status === "approved" && !locum.is_bookable ? (
          <span className="text-sm text-muted">
            Approved, but held out of search until the documents below are cleared.
          </span>
        ) : null}
      </div>

      {locum.suspension_reason ? (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Reason on file: {locum.suspension_reason}
        </p>
      ) : null}

      {locum.status === "pending" ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Waiting on a decision</h2>
          <ApprovalRow
            id={locum.id}
            kind="locum"
            title={name}
            subtitle={`${locum.roles?.name} · ${locum.years_experience} years · ${locum.base_postcode}`}
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Contact">
          <Row label="Name" value={name} />
          <Row label="Email" value={locum.profiles?.email ?? "—"} href={
            locum.profiles?.email ? `mailto:${locum.profiles.email}` : undefined
          } />
          <Row label="Phone" value={locum.profiles?.phone ?? "—"} href={
            locum.profiles?.phone ? `tel:${locum.profiles.phone}` : undefined
          } />
          <Row label="WhatsApp alerts" value={locum.profiles?.whatsapp_opt_in ? "Yes" : "No"} />
          <Row label="Registered" value={stampDate(locum.created_at)} />
          {locum.approved_at ? <Row label="Approved" value={stampDate(locum.approved_at)} /> : null}
        </Panel>

        <Panel title="Work">
          <Row label="Role" value={locum.roles?.name ?? "—"} />
          <Row label="Experience" value={`${locum.years_experience} years`} />
          <Row label="GDC number" value={locum.gdc_number ?? "—"} />
          <Row
            label="GDC expiry"
            value={locum.gdc_expiry ? shiftDate(locum.gdc_expiry) : "—"}
          />
          <Row label="Based" value={locum.base_postcode} />
          <Row label="Travels" value={`${locum.travel_radius_miles} miles`} />
          {locum.specialisms?.length ? (
            <Row label="Specialisms" value={locum.specialisms.join(", ")} />
          ) : null}
        </Panel>
      </div>

      {locum.bio ? (
        <section className="mt-6">
          <Panel title="Bio">
            <p className="whitespace-pre-line text-sm">{locum.bio}</p>
          </Panel>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">
          Compliance{" "}
          {outstanding.length > 0 ? (
            <span className="text-sm font-normal text-muted">
              — {outstanding.length} outstanding
            </span>
          ) : null}
        </h2>
        {checklist.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-muted">
            No documents visible. Compliance records are limited to super admin, operations and
            compliance roles.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[34rem] text-sm">
              <tbody>
                {checklist.map((row) => (
                  <tr key={row.docType} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3">
                      {row.document ? (
                        <DocumentBadge status={row.document.status} />
                      ) : (
                        <Badge tone="amber">Not uploaded</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.document?.expiry_date
                        ? `Expires ${shiftDate(row.document.expiry_date)}`
                        : row.requiresExpiry
                          ? "—"
                          : "No expiry"}
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
          <h2 className="mb-3 text-lg font-bold">Rates</h2>
          {rates.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-muted">
              No rates set yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 capitalize">{r.day_type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-semibold">{hourly(r.hourly_rate)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={r.status === "approved" ? "mint" : "amber"}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
                      <td className="px-4 py-3">{b.practices?.name ?? "—"}</td>
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

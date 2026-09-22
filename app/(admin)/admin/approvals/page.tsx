import { pendingPractices } from "@/features/admin/queries";
import { pendingLocums, pendingRateRequests } from "@/features/locums/queries";
import { ApprovalRow } from "@/features/admin/components/approval-row";
import { RateDecision } from "@/features/admin/components/rate-decision";
import { PageHeading } from "@/components/layout/portal-shell";
import { hourly } from "@/lib/format";

export default async function ApprovalsPage() {
  const [practices, locums, rates] = await Promise.all([
    pendingPractices(),
    pendingLocums(),
    pendingRateRequests(),
  ]);

  return (
    <>
      <PageHeading title="Approvals" lede="Nothing goes live until it's been through here." />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold">Practices ({practices.length})</h2>
        {practices.length === 0 ? (
          <p className="text-muted">Nothing waiting.</p>
        ) : (
          <div className="space-y-3">
            {practices.map((p) => (
              <ApprovalRow
                key={p.id}
                id={p.id}
                kind="practice"
                title={p.name}
                subtitle={`${p.city}, ${p.postcode}${p.email ? ` · ${p.email}` : ""}`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold">Locums ({locums.length})</h2>
        {locums.length === 0 ? (
          <p className="text-muted">Nothing waiting.</p>
        ) : (
          <div className="space-y-3">
            {locums.map((l) => (
              <ApprovalRow
                key={l.id}
                id={l.id}
                kind="locum"
                title={l.profiles?.full_name ?? "Unnamed"}
                subtitle={`${l.roles?.name} · ${l.years_experience} years · ${l.base_postcode}${
                  l.gdc_number ? ` · GDC ${l.gdc_number}` : ""
                }`}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Rate changes ({rates.length})</h2>
        {rates.length === 0 ? (
          <p className="text-muted">Nothing waiting.</p>
        ) : (
          <div className="space-y-3">
            {rates.map((r) => (
              <RateDecision
                key={r.id}
                rateId={r.id}
                name={r.locums?.profiles?.full_name ?? "Unnamed"}
                dayType={r.day_type}
                amount={hourly(Number(r.hourly_rate))}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

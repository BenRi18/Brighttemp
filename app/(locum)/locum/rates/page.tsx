import { requireLocum } from "@/features/auth/session";
import { listRates } from "@/features/locums/queries";
import { RateForm } from "@/features/locums/components/rate-form";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/layout/portal-shell";
import { hourly } from "@/lib/format";

const LABELS: Record<string, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
  bank_holiday: "Bank holiday",
};

export default async function RatesPage() {
  const { locum } = await requireLocum();
  const rates = await listRates(locum.id);
  const approved = rates.filter((r) => r.status === "approved");
  const pending = rates.filter((r) => r.status === "pending");

  const current = Object.fromEntries(approved.map((r) => [r.day_type, Number(r.hourly_rate)]));

  return (
    <>
      <PageHeading
        title="Your rates"
        lede="You set these. Brighttemp never takes a percentage — practices pay us a separate flat fee."
      />

      <section className="mb-8 rounded-xl border border-line bg-white p-5">
        <h2 className="mb-4 font-bold">Live rates</h2>
        {approved.length === 0 ? (
          <p className="text-muted">No approved rates yet — set them below.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            {approved.map((r) => (
              <div key={r.id}>
                <dt className="text-sm text-muted">{LABELS[r.day_type]}</dt>
                <dd className="text-2xl font-extrabold tracking-tight">{hourly(Number(r.hourly_rate))}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {pending.length > 0 && (
        <section className="mb-8 rounded-xl border border-[#F0DFA8] bg-[#FFF7E0] p-5">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-bold text-[#54451A]">Awaiting approval</h2>
            <Badge tone="amber">pending</Badge>
          </div>
          <p className="mb-3 text-sm text-[#54451A]">
            Your live rates above stay in force until these are approved.
          </p>
          <ul className="text-sm text-[#54451A]">
            {pending.map((r) => (
              <li key={r.id}>
                {LABELS[r.day_type]}: {hourly(Number(r.hourly_rate))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <RateForm current={current} />
    </>
  );
}

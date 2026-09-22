import { listInvoices, invoiceTotals } from "@/features/invoicing/queries";
import { InvoiceRow } from "@/features/invoicing/components/invoice-row";
import { PageHeading } from "@/components/layout/portal-shell";
import { money } from "@/lib/format";

export default async function AdminInvoicesPage() {
  const [invoices, totals] = await Promise.all([listInvoices(), invoiceTotals()]);

  return (
    <>
      <PageHeading title="Invoices" lede="Brighttemp booking fees only — never the locum's pay." />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-3xl font-extrabold tracking-tight">{money(totals.outstanding)}</p>
          <p className="mt-1 text-sm text-muted">Outstanding</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-3xl font-extrabold tracking-tight">{money(totals.paid)}</p>
          <p className="mt-1 text-sm text-muted">Paid</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted">No invoices yet.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((i) => (
            <InvoiceRow
              key={i.id}
              id={i.id}
              number={i.invoice_number}
              practice={i.practices?.name ?? "—"}
              total={Number(i.total)}
              status={i.status}
              dueDate={i.due_date}
              admin
            />
          ))}
        </div>
      )}
    </>
  );
}

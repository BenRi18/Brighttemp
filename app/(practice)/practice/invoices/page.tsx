import { listInvoices } from "@/features/invoicing/queries";
import { InvoiceRow } from "@/features/invoicing/components/invoice-row";
import { PageHeading } from "@/components/layout/portal-shell";

export default async function PracticeInvoicesPage() {
  const invoices = await listInvoices();

  return (
    <>
      <PageHeading
        title="Invoices"
        lede="Brighttemp booking fees only. What you pay the locum is settled directly with them."
      />

      {invoices.length === 0 ? (
        <p className="text-muted">No invoices yet.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((i) => (
            <InvoiceRow
              key={i.id}
              id={i.id}
              number={i.invoice_number}
              practice={i.bookings?.reference ?? ""}
              total={Number(i.total)}
              status={i.status}
              dueDate={i.due_date}
            />
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import { useActionState } from "react";
import { issueInvoice, recordPayment } from "@/features/invoicing/actions";
import type { ActionState } from "@/features/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/form";
import { money } from "@/lib/format";
import type { Enums } from "@/lib/database.types";

const TONE: Record<Enums<"invoice_status">, "neutral" | "amber" | "mint" | "red"> = {
  draft: "neutral",
  sent: "amber",
  paid: "mint",
  overdue: "red",
  cancelled: "neutral",
};

export function InvoiceRow({
  id,
  number,
  practice,
  total,
  status,
  dueDate,
  admin = false,
}: {
  id: string;
  number: string;
  practice: string;
  total: number;
  status: Enums<"invoice_status">;
  dueDate: string;
  admin?: boolean;
}) {
  const [issueState, issue] = useActionState<ActionState, FormData>(issueInvoice, {});
  const [payState, pay] = useActionState<ActionState, FormData>(recordPayment, {});
  const state = issueState.message || issueState.error ? issueState : payState;

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {number} <Badge tone={TONE[status]}>{status}</Badge>
          </p>
          <p className="text-sm text-muted">
            {practice} · due {new Date(dueDate).toLocaleDateString("en-GB")}
          </p>
        </div>

        <p className="font-bold">{money(total)}</p>

        {admin && status === "draft" && (
          <form action={issue}>
            <input type="hidden" name="invoiceId" value={id} />
            <button className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white">
              Issue
            </button>
          </form>
        )}

        {admin && (status === "sent" || status === "overdue") && (
          <form action={pay} className="flex items-center gap-2">
            <input type="hidden" name="invoiceId" value={id} />
            <input type="hidden" name="amount" value={total} />
            <input type="hidden" name="method" value="bank_transfer" />
            <button className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-pine">
              Mark paid
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

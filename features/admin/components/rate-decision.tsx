"use client";

import { useActionState } from "react";
import { reviewRateChange } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

export function RateDecision({
  rateId,
  name,
  dayType,
  amount,
}: {
  rateId: string;
  name: string;
  dayType: string;
  amount: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reviewRateChange, {});
  if (state.message) return <Banner tone="success">{state.message}</Banner>;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted">
          {dayType.replace("_", " ")} → {amount}
        </p>
      </div>
      <form action={action} className="flex gap-2">
        <input type="hidden" name="rateId" value={rateId} />
        <button
          name="decision"
          value="approve"
          className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white"
        >
          Approve
        </button>
        <button
          name="decision"
          value="reject"
          className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-muted"
        >
          Reject
        </button>
      </form>
    </div>
  );
}

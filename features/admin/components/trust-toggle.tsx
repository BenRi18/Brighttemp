"use client";

import { useActionState } from "react";
import { setTrustLevel } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

/**
 * Trusted practices book a locum outright; new ones raise a request the locum
 * has to accept. It's the one setting that changes how a booking behaves, so
 * it says which way round it currently is rather than just offering a button.
 */
export function TrustToggle({
  practiceId,
  trustLevel,
}: {
  practiceId: string;
  trustLevel: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setTrustLevel, {});
  const trusted = trustLevel === "trusted";
  const next = trusted ? "new" : "trusted";

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-1 text-lg font-bold">Booking permission</h2>
      <p className="mb-3 text-sm text-muted">
        {trusted
          ? "Trusted — bookings are confirmed the moment this practice makes them."
          : "New — every booking waits for the locum to accept it."}
      </p>

      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <form action={action}>
        <input type="hidden" name="practiceId" value={practiceId} />
        <input type="hidden" name="trustLevel" value={next} />
        <button
          className={`rounded-full px-5 py-2 text-sm font-semibold ${
            trusted ? "border border-line text-muted" : "bg-pine text-white"
          }`}
        >
          {trusted ? "Require locum approval again" : "Allow instant booking"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { claimShift, withdrawClaim } from "@/features/shifts/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

/**
 * Putting your hand up for a shift.
 *
 * Says plainly that offering is not being booked — the practice may have
 * several people to choose from, and a locum who thinks they have the work
 * and turns down something else would have a fair complaint.
 */
export function ClaimButton({
  shiftId,
  claimed,
  canClaim,
}: {
  shiftId: string;
  claimed: boolean;
  /** False when they have no approved rate for that day type yet. */
  canClaim: boolean;
}) {
  const [claimState, claim] = useActionState<ActionState, FormData>(claimShift, {});
  const [dropState, drop] = useActionState<ActionState, FormData>(withdrawClaim, {});
  const [open, setOpen] = useState(false);

  const state = claimState.error || claimState.message ? claimState : dropState;

  if (!canClaim) {
    return (
      <p className="text-sm text-muted">
        Set a rate for this type of day on your Rates page, and get it approved, before
        offering for shifts.
      </p>
    );
  }

  if (claimed) {
    return (
      <div>
        {state.error ? <Banner tone="error">{state.error}</Banner> : null}
        {state.message ? <Banner tone="success">{state.message}</Banner> : null}
        <p className="mb-2 text-sm font-semibold text-[#0E3B36]">
          You&apos;ve offered for this one. The practice will confirm or go with someone else.
        </p>
        <form action={drop}>
          <input type="hidden" name="shiftId" value={shiftId} />
          <button className="text-sm font-semibold text-muted underline">Pull out</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <form action={claim} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="shiftId" value={shiftId} />
        {open ? (
          <label className="min-w-[14rem] flex-1 text-sm">
            <span className="mb-1 block font-semibold">Anything to tell them (optional)</span>
            <input
              type="text"
              name="message"
              maxLength={300}
              placeholder="I've covered for you before"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>
        ) : null}
        <button className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-[#12211F]">
          I&apos;m available
        </button>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-muted underline"
          >
            Add a note
          </button>
        ) : null}
      </form>
    </div>
  );
}

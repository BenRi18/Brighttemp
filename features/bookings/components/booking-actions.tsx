"use client";

import { useActionState, useState } from "react";
import {
  acceptBooking,
  cancelBooking,
  completeBooking,
} from "@/features/bookings/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";
import type { BookingStatus } from "@/lib/database.types";

const OPEN: BookingStatus[] = ["requested", "accepted", "confirmed"];

export function BookingActions({
  bookingId,
  status,
  viewer,
  noticeHours,
  cancellationFee,
}: {
  bookingId: string;
  status: BookingStatus;
  viewer: "practice" | "locum" | "admin";
  noticeHours: number;
  cancellationFee: number;
}) {
  const [acceptState, accept] = useActionState<ActionState, FormData>(acceptBooking, {});
  const [cancelState, cancel] = useActionState<ActionState, FormData>(cancelBooking, {});
  const [completeState, complete] = useActionState<ActionState, FormData>(completeBooking, {});
  const [confirming, setConfirming] = useState(false);

  const state = acceptState.error || acceptState.message ? acceptState
    : cancelState.error || cancelState.message ? cancelState
    : completeState;

  if (!OPEN.includes(status)) {
    return state.message ? <Banner tone="success">{state.message}</Banner> : null;
  }

  const chargeable = viewer === "practice" && cancellationFee > 0;

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <div className="flex flex-wrap gap-3">
        {viewer === "locum" && status === "requested" && (
          <form action={accept}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <button className="rounded-full bg-pine px-5 py-2.5 font-semibold text-white">
              Accept shift
            </button>
          </form>
        )}

        {viewer === "practice" && status === "confirmed" && (
          <form action={complete}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <button className="rounded-full bg-pine px-5 py-2.5 font-semibold text-white">
              Mark as worked
            </button>
          </form>
        )}

        {!confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-full border border-line px-5 py-2.5 font-semibold text-muted"
          >
            {viewer === "locum" && status === "requested" ? "Decline" : "Cancel booking"}
          </button>
        )}
      </div>

      {confirming && (
        <form action={cancel} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          {/* The fee is shown before they commit, not after it has been charged. */}
          {chargeable ? (
            <p className="mb-3 rounded-lg border border-[#F0DFA8] bg-[#FFF7E0] px-4 py-3 text-sm text-[#54451A]">
              This is inside the notice window ({Math.floor(noticeHours)} hours to the shift), so a
              £{cancellationFee.toFixed(2)} cancellation fee applies.
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted">
              No cancellation fee applies at this notice.
            </p>
          )}

          <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold text-muted">
            Reason
          </label>
          <input
            id="reason"
            name="reason"
            required
            maxLength={500}
            className="mb-3 w-full rounded-lg border border-line px-3 py-2.5"
            placeholder="Patient list moved, cover no longer needed…"
          />
          <div className="flex gap-3">
            <button className="rounded-full bg-red-700 px-5 py-2.5 font-semibold text-white">
              Confirm cancellation
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full border border-line px-5 py-2.5 font-semibold text-muted"
            >
              Keep it
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

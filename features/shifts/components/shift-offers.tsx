"use client";

import { useActionState } from "react";
import Link from "next/link";
import { awardShift, withdrawShift } from "@/features/shifts/actions";
import type { ActionState } from "@/features/auth/actions";
import type { PracticeShift } from "@/features/shifts/queries";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/form";
import { money, hourly, shiftDate, shiftTimes } from "@/lib/format";

/**
 * One posted shift and whoever has offered for it.
 *
 * The rate is the thing being compared, so it leads — cheapest first, with
 * the total for the shift next to it, because an hourly rate on its own is
 * not what the practice pays.
 */
export function ShiftOffers({ shift }: { shift: PracticeShift }) {
  const [awardState, award] = useActionState<ActionState, FormData>(awardShift, {});
  const [withdrawState, withdraw] = useActionState<ActionState, FormData>(withdrawShift, {});

  const offers = shift.claims.filter((c) => c.status === "offered");
  const winner = shift.claims.find((c) => c.status === "accepted");
  const open = shift.status === "open";

  return (
    <article className="rounded-xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">
            {shift.roleName} — {shiftDate(shift.shiftDate)}
          </h3>
          <p className="text-sm text-muted">
            {shiftTimes(shift.startTime, shift.finishTime)} · {shift.hours} hours
          </p>
        </div>
        <StatusBadge status={shift.status} />
      </div>

      {shift.notes ? <p className="mb-3 text-sm text-muted">{shift.notes}</p> : null}

      {awardState.error ? <Banner tone="error">{awardState.error}</Banner> : null}
      {awardState.message ? <Banner tone="success">{awardState.message}</Banner> : null}
      {withdrawState.error ? <Banner tone="error">{withdrawState.error}</Banner> : null}
      {withdrawState.message ? <Banner tone="success">{withdrawState.message}</Banner> : null}

      {winner ? (
        <p className="rounded-lg bg-[#EAF0EA] px-4 py-3 text-sm">
          Booked with <strong>{winner.name}</strong> at {hourly(winner.hourlyRate)} —{" "}
          {money(winner.total)} for the shift.
          {shift.bookingId ? (
            <>
              {" "}
              <Link href={`/practice/bookings/${shift.bookingId}`} className="underline">
                Open the booking
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {open && offers.length === 0 ? (
        <p className="text-sm text-muted">
          Nobody has offered yet. Locums who can cover it have been told.
        </p>
      ) : null}

      {open && offers.length > 0 ? (
        <>
          <p className="mb-2 text-sm font-semibold">
            {offers.length} {offers.length === 1 ? "locum is" : "locums are"} available
          </p>
          <ul className="mb-4 divide-y divide-line border-y border-line">
            {offers.map((c) => (
              <li key={c.claimId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.yearsExperience} years&apos; experience
                    {c.message ? ` · "${c.message}"` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{money(c.total)}</p>
                  <p className="text-muted">{hourly(c.hourlyRate)}</p>
                </div>
                <form action={award}>
                  <input type="hidden" name="shiftId" value={shift.id} />
                  <input type="hidden" name="claimId" value={c.claimId} />
                  <button className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white">
                    Book {c.name.split(" ")[0]}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mb-3 text-xs text-muted">
            Booking fee is added on top and shown on the invoice, as with any booking.
          </p>
        </>
      ) : null}

      {open ? (
        <form action={withdraw}>
          <input type="hidden" name="shiftId" value={shift.id} />
          <button className="text-sm font-semibold text-muted underline">
            Take this shift down
          </button>
        </form>
      ) : null}
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "filled") return <Badge tone="mint">Filled</Badge>;
  if (status === "withdrawn") return <Badge tone="neutral">Taken down</Badge>;
  if (status === "expired") return <Badge tone="neutral">Expired</Badge>;
  return <Badge tone="amber">Open</Badge>;
}

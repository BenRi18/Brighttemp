"use client";

import { useActionState } from "react";
import { setAvailability, setAvailabilityRange } from "@/features/locums/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";
import { shiftDate, addDaysISO, todayISO } from "@/lib/format";

type Day = {
  id: string;
  available_on: string;
  is_available: boolean;
  start_time: string | null;
  finish_time: string | null;
  note: string | null;
};

export function AvailabilityEditor({ days }: { days: Day[] }) {
  const [bulkState, bulkAction] = useActionState<ActionState, FormData>(setAvailabilityRange, {});
  const [dayState, dayAction] = useActionState<ActionState, FormData>(setAvailability, {});

  const field = "w-full rounded-lg border border-line px-3 py-2 text-sm";
  const available = days.filter((d) => d.is_available);

  return (
    <>
      <section className="mb-8 rounded-xl border border-line bg-white p-5">
        <h2 className="mb-1 font-bold">Mark a run of days</h2>
        <p className="mb-4 text-sm text-muted">
          The quickest way to fill a month. You can still change individual days afterwards.
        </p>

        {bulkState.error ? <Banner tone="error">{bulkState.error}</Banner> : null}
        {bulkState.message ? <Banner tone="success">{bulkState.message}</Banner> : null}

        <form action={bulkAction} className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted" htmlFor="fromDate">From</label>
            <input id="fromDate" name="fromDate" type="date" defaultValue={todayISO()} className={field} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted" htmlFor="toDate">To</label>
            <input id="toDate" name="toDate" type="date" defaultValue={addDaysISO(30)} className={field} required />
            {bulkState.fieldErrors?.toDate ? (
              <p className="mt-1 text-xs text-red-600">{bulkState.fieldErrors.toDate[0]}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted" htmlFor="bulkStart">Start</label>
            <input id="bulkStart" name="startTime" type="time" defaultValue="09:00" className={field} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted" htmlFor="bulkFinish">Finish</label>
            <input id="bulkFinish" name="finishTime" type="time" defaultValue="17:00" className={field} required />
            {bulkState.fieldErrors?.finishTime ? (
              <p className="mt-1 text-xs text-red-600">{bulkState.fieldErrors.finishTime[0]}</p>
            ) : null}
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-full bg-pine px-4 py-2.5 text-sm font-semibold text-white">
              Mark available
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted md:col-span-5">
            <input type="checkbox" name="weekdaysOnly" defaultChecked />
            Weekdays only
          </label>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-4 font-bold">Next 90 days</h2>
        {dayState.error ? <Banner tone="error">{dayState.error}</Banner> : null}

        {available.length === 0 ? (
          <p className="text-muted">Nothing marked yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {available.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1 font-medium">{shiftDate(d.available_on)}</span>
                <span className="text-sm text-muted">
                  {d.start_time?.slice(0, 5)}–{d.finish_time?.slice(0, 5)}
                </span>
                <form action={dayAction}>
                  <input type="hidden" name="date" value={d.available_on} />
                  <input type="hidden" name="isAvailable" value="false" />
                  <button className="text-sm text-muted underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

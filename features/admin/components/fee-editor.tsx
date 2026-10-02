"use client";

import { useActionState } from "react";
import { updateFee, updateFlatFee } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

const DAY_TYPES = [
  { value: "weekday", label: "Weekday" },
  { value: "weekend", label: "Weekend" },
  { value: "bank_holiday", label: "Bank holiday" },
] as const;

export function FeeEditor({
  roles,
  lookup,
  sameDay,
  cancellation,
  cancellationNoticeHours,
}: {
  roles: { id: string; name: string }[];
  lookup: Record<string, number>;
  sameDay: number;
  cancellation: number;
  cancellationNoticeHours: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateFee, {});
  const [flatState, flatAction] = useActionState<ActionState, FormData>(updateFlatFee, {});

  return (
    <>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}
      {flatState.error ? <Banner tone="error">{flatState.error}</Banner> : null}
      {flatState.message ? <Banner tone="success">{flatState.message}</Banner> : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-[#EAF0EA] text-left text-sm text-muted">
              <th className="px-4 py-3 font-semibold">Role</th>
              {DAY_TYPES.map((d) => (
                <th key={d.value} className="px-4 py-3 font-semibold">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{role.name}</td>
                {DAY_TYPES.map((d) => (
                  <td key={d.value} className="px-4 py-3">
                    <form action={action} className="flex items-center gap-2">
                      <input type="hidden" name="roleId" value={role.id} />
                      <input type="hidden" name="dayType" value={d.value} />
                      <span className="text-muted">£</span>
                      <input
                        name="amount"
                        type="number"
                        step="0.50"
                        min="0"
                        defaultValue={lookup[`${role.id}:${d.value}`] ?? 0}
                        className="w-24 rounded-lg border border-line px-2 py-1.5"
                      />
                      <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-pine">
                        Save
                      </button>
                    </form>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-bold">Same-day booking</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Added to the booking fee when a practice books cover for that same day.
          </p>
          <form action={flatAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="feeType" value="same_day_surcharge" />
            <div>
              <label htmlFor="same-day-amount" className="mb-1 block text-sm font-semibold text-muted">
                Surcharge
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted">£</span>
                <input
                  id="same-day-amount"
                  name="amount"
                  type="number"
                  step="0.50"
                  min="0"
                  defaultValue={sameDay}
                  className="w-28 rounded-lg border border-line px-2 py-1.5"
                />
              </div>
            </div>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-pine">
              Save
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-bold">Cancellation</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Charged to the practice when it cancels inside the notice window.
          </p>
          <form action={flatAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="feeType" value="cancellation" />
            <div>
              <label htmlFor="cancel-amount" className="mb-1 block text-sm font-semibold text-muted">
                Fee
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted">£</span>
                <input
                  id="cancel-amount"
                  name="amount"
                  type="number"
                  step="0.50"
                  min="0"
                  defaultValue={cancellation}
                  className="w-28 rounded-lg border border-line px-2 py-1.5"
                />
              </div>
            </div>
            <div>
              <label htmlFor="cancel-notice" className="mb-1 block text-sm font-semibold text-muted">
                Applies under
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cancel-notice"
                  name="noticeHoursBelow"
                  type="number"
                  min="1"
                  max="336"
                  defaultValue={cancellationNoticeHours}
                  className="w-24 rounded-lg border border-line px-2 py-1.5"
                />
                <span className="text-muted">hours notice</span>
              </div>
            </div>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-pine">
              Save
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
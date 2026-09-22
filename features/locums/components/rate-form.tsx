"use client";

import { useActionState } from "react";
import { requestRateChange } from "@/features/locums/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

export function RateForm({ current }: { current: Record<string, number> }) {
  const [state, action] = useActionState<ActionState, FormData>(requestRateChange, {});
  const field = "w-full rounded-lg border border-line px-3 py-2.5";

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-1 font-bold">Request a rate change</h2>
      <p className="mb-4 text-sm text-muted">
        Brighttemp reviews changes so practices aren&apos;t surprised mid-booking.
      </p>

      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <form action={action} className="grid gap-4 sm:grid-cols-3">
        {[
          { name: "weekday", label: "Weekday (£/hr)", fallback: 18 },
          { name: "weekend", label: "Weekend (£/hr)", fallback: 22 },
          { name: "bankHoliday", label: "Bank holiday (£/hr)", fallback: 26 },
        ].map((f) => {
          const key = f.name === "bankHoliday" ? "bank_holiday" : f.name;
          return (
            <div key={f.name}>
              <label htmlFor={f.name} className="mb-1.5 block text-sm font-semibold text-muted">
                {f.label}
              </label>
              <input
                id={f.name}
                name={f.name}
                type="number"
                step="0.25"
                min="1"
                max="500"
                required
                defaultValue={current[key] ?? f.fallback}
                className={field}
              />
              {state.fieldErrors?.[f.name] ? (
                <p className="mt-1 text-xs text-red-600">{state.fieldErrors[f.name][0]}</p>
              ) : null}
            </div>
          );
        })}
        <div className="sm:col-span-3">
          <button className="rounded-full bg-pine px-6 py-2.5 font-semibold text-white">
            Submit for approval
          </button>
        </div>
      </form>
    </section>
  );
}

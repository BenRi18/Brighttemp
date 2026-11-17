"use client";

import { useActionState } from "react";
import { postShift } from "@/features/shifts/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner, Field, SelectField, SubmitButton } from "@/components/ui/form";

/**
 * Posting a gap.
 *
 * Deliberately short. A practice doing this is short-staffed for Tuesday and
 * wants it off their desk — role, when, and anything the locum needs to know
 * walking in. No rate: each locum offers at their own, and the practice
 * compares them when choosing.
 */
export function PostShiftForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(postShift, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-1 text-lg font-bold">Post a shift</h2>
      <p className="mb-4 text-sm text-muted">
        Anyone qualified and free nearby will see it and can offer. You choose who
        gets it — nothing is booked until you do.
      </p>

      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <form action={action}>
        <SelectField
          label="Role needed"
          name="roleId"
          errors={state.fieldErrors?.roleId}
          options={[
            { value: "", label: "Choose a role" },
            ...roles.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />

        <Field
          label="Date"
          name="shiftDate"
          type="date"
          min={today}
          errors={state.fieldErrors?.shiftDate}
        />

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field
            label="Starts"
            name="startTime"
            type="time"
            defaultValue="09:00"
            errors={state.fieldErrors?.startTime}
          />
          <Field
            label="Finishes"
            name="finishTime"
            type="time"
            defaultValue="17:00"
            errors={state.fieldErrors?.finishTime}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="shift-notes" className="mb-1.5 block text-sm font-semibold text-muted">
            Anything they should know (optional)
          </label>
          <textarea
            id="shift-notes"
            name="notes"
            rows={3}
            maxLength={500}
            placeholder="Parking round the back, ask for Sam on reception…"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-amber"
          />
        </div>

        <SubmitButton>Post the shift</SubmitButton>
      </form>
    </section>
  );
}

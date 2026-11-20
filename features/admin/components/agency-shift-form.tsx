"use client";

import { useActionState, useState } from "react";
import { adminPostShift, createManagedPractice } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import type { PostingPractice } from "@/features/shifts/queries";
import { Banner, Field, SelectField, SubmitButton } from "@/components/ui/form";

/**
 * Posting a shift for a practice that rang up.
 *
 * Two forms, one above the other, because a call usually goes one of two
 * ways: the practice is already on the list, or it is the first time they
 * have rung and there is nothing to attach the shift to. Adding them is
 * three fields and sits right here rather than on another page, so the
 * shift can be posted while they are still on the phone.
 */
export function AgencyShiftForm({
  practices,
  roles,
}: {
  practices: PostingPractice[];
  roles: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(adminPostShift, {});
  const [addingPractice, setAddingPractice] = useState(practices.length === 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-1 text-lg font-bold">Post a shift</h2>
        <p className="mb-4 text-sm text-muted">
          Goes on the board for every locum who could cover it — right role, documents
          in date, and close enough for the distance they said they&apos;ll travel.
        </p>

        {state.error ? <Banner tone="error">{state.error}</Banner> : null}
        {state.message ? <Banner tone="success">{state.message}</Banner> : null}

        {practices.length === 0 ? (
          <p className="rounded-lg bg-[#FFF7E0] px-4 py-3 text-sm text-[#54451A]">
            No practices available to post for yet. Add one below.
          </p>
        ) : (
          <form action={action}>
            <SelectField
              label="Which practice"
              name="practiceId"
              errors={state.fieldErrors?.practiceId}
              options={[
                { value: "", label: "Choose a practice" },
                ...practices.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.city ? ` — ${p.city}` : ""}${
                    p.isManaged ? " (phone)" : ""
                  }`,
                })),
              ]}
            />

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
              <label
                htmlFor="agency-notes"
                className="mb-1.5 block text-sm font-semibold text-muted"
              >
                Anything the locum should know (optional)
              </label>
              <textarea
                id="agency-notes"
                name="notes"
                rows={3}
                maxLength={500}
                placeholder="Parking round the back, ask for Sam on reception…"
                className="w-full rounded-lg border border-line px-3 py-2.5 text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-amber"
              />
            </div>

            <SubmitButton>Post the shift</SubmitButton>
          </form>
        )}
      </section>

      {addingPractice ? (
        <ManagedPracticeForm onDone={() => setAddingPractice(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAddingPractice(true)}
          className="text-sm font-semibold text-pine underline"
        >
          The practice isn&apos;t on the list — add them
        </button>
      )}
    </div>
  );
}

/**
 * A practice Brighttemp runs by phone.
 *
 * No login and no portal: this record exists so a shift has somewhere to
 * hang a booking and an invoice. The postcode is the one field that must be
 * right — it decides which locums ever see their shifts.
 */
function ManagedPracticeForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(createManagedPractice, {});

  return (
    <section className="rounded-xl border border-line bg-[#F7F4EC] p-5">
      <h2 className="mb-1 text-lg font-bold">Add a practice</h2>
      <p className="mb-4 text-sm text-muted">
        For practices that deal with you by phone. They get no login — this is so
        their bookings and invoices work. They can register properly later.
      </p>

      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <form action={action}>
        <Field label="Practice name" name="name" errors={state.fieldErrors?.name} />
        <Field label="Address" name="addressLine1" errors={state.fieldErrors?.addressLine1} />
        <Field
          label="Address line 2 (optional)"
          name="addressLine2"
          errors={state.fieldErrors?.addressLine2}
        />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Town or city" name="city" errors={state.fieldErrors?.city} />
          <Field label="Postcode" name="postcode" errors={state.fieldErrors?.postcode} />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Phone (optional)" name="phone" errors={state.fieldErrors?.phone} />
          <Field
            label="Email (optional)"
            name="email"
            type="email"
            errors={state.fieldErrors?.email}
          />
        </div>

        <p className="mb-4 text-sm text-muted">
          An email here means they get the booking confirmation and the invoice
          automatically. Without one you&apos;ll be sending those yourself.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton>Add the practice</SubmitButton>
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-semibold text-muted underline"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

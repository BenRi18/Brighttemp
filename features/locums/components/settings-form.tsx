"use client";

import { useActionState } from "react";
import { updateLocumProfile } from "@/features/locums/actions";
import type { ActionState } from "@/features/auth/actions";
import type { Locum } from "@/lib/database.types";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export function LocumSettingsForm({ locum }: { locum: Locum }) {
  const [state, action] = useActionState<ActionState, FormData>(updateLocumProfile, {});

  return (
    <form action={action} className="max-w-xl rounded-xl border border-line bg-white p-5">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <Field label="Years of experience" name="yearsExperience" type="number" min={0} max={60}
             defaultValue={locum.years_experience} required
             errors={state.fieldErrors?.yearsExperience} />
      <Field label="Home postcode" name="basePostcode" defaultValue={locum.base_postcode} required
             hint="Practices see the distance, never your address."
             errors={state.fieldErrors?.basePostcode} />
      <Field label="Travel radius (miles)" name="travelRadiusMiles" type="number" min={1} max={200}
             defaultValue={locum.travel_radius_miles} required
             errors={state.fieldErrors?.travelRadiusMiles} />

      <div className="mb-5">
        <label htmlFor="bio" className="mb-1.5 block text-sm font-semibold text-muted">
          About you
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={1000}
          defaultValue={locum.bio ?? ""}
          className="w-full rounded-lg border border-line px-3 py-2.5"
        />
      </div>

      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

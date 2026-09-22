"use client";

import { useActionState } from "react";
import { completeLocumOnboarding, type ActionState } from "@/features/auth/actions";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

type Role = { id: string; name: string; slug: string };

export function LocumOnboardingForm({ roles }: { roles: Role[] }) {
  const [state, action] = useActionState<ActionState, FormData>(
    completeLocumOnboarding,
    {},
  );

  return (
    <form action={action} noValidate>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}

      <div className="mb-4">
        <label htmlFor="roleId" className="mb-1.5 block text-sm font-semibold text-[#5E7370]">
          Your role
        </label>
        <select
          id="roleId"
          name="roleId"
          required
          defaultValue=""
          className="w-full rounded-lg border border-[#D5DFD8] bg-white px-3 py-2.5 text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-[#FFC93D]"
        >
          <option value="" disabled>
            Choose…
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.roleId ? (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.roleId[0]}</p>
        ) : null}
      </div>

      <Field label="GDC number" name="gdcNumber"
             hint="Leave blank if your role doesn't require registration."
             errors={state.fieldErrors?.gdcNumber} />
      <Field label="Years of experience" name="yearsExperience" type="number"
             min={0} max={60} defaultValue={0} required
             errors={state.fieldErrors?.yearsExperience} />
      <Field label="Home postcode" name="basePostcode" required placeholder="LS6 2AA"
             hint="Distances are measured from here. Practices never see your full address."
             errors={state.fieldErrors?.basePostcode} />
      <Field label="How far will you travel?" name="travelRadiusMiles" type="number"
             min={1} max={200} defaultValue={20} required
             hint="In miles."
             errors={state.fieldErrors?.travelRadiusMiles} />

      <div className="mb-5">
        <label htmlFor="bio" className="mb-1.5 block text-sm font-semibold text-[#5E7370]">
          About you
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={1000}
          className="w-full rounded-lg border border-[#D5DFD8] px-3 py-2.5 text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-[#FFC93D]"
          placeholder="Practice types you've worked in, software you know, anything a practice manager would want to know."
        />
      </div>

      <SubmitButton>Save and upload documents</SubmitButton>
    </form>
  );
}

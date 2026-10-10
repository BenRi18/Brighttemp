"use client";

import { useActionState } from "react";
import { type ActionState } from "@/features/auth/actions";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

/**
 * Both registrations share the credentials half; what differs is who is
 * registering. A locum signs up as a person — first name and surname kept
 * apart, so lists can be sorted and emails can open "Hi Ben". A practice signs
 * up as a business, and gives its address here so the onboarding step is a
 * confirmation rather than a second round of typing.
 */
export function RegisterForm({
  action,
  cta,
  variant,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  cta: string;
  variant: "locum" | "practice";
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const e = state.fieldErrors;

  if (state.message) {
    return <Banner tone="success">{state.message}</Banner>;
  }

  return (
    <form action={formAction} noValidate>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}

      {variant === "locum" ? (
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" autoComplete="given-name" required
                 errors={e?.firstName} />
          <Field label="Surname" name="lastName" autoComplete="family-name" required
                 errors={e?.lastName} />
        </div>
      ) : (
        <>
          <Field label="Practice name" name="practiceName" autoComplete="organization" required
                 errors={e?.practiceName} />
          <Field label="Address" name="addressLine1" autoComplete="address-line1" required
                 errors={e?.addressLine1} />
          <Field label="Address line 2" name="addressLine2" autoComplete="address-line2"
                 errors={e?.addressLine2} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Town or city" name="city" autoComplete="address-level2" required
                   errors={e?.city} />
            <Field label="Postcode" name="postcode" autoComplete="postal-code" required
                   placeholder="LS1 4DY" errors={e?.postcode} />
          </div>
        </>
      )}

      <Field label="Email" name="email" type="email" autoComplete="email" required
             errors={e?.email} />
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel"
             hint="Used for booking alerts. Optional."
             errors={e?.phone} />
      <Field label="Password" name="password" type="password"
             autoComplete="new-password" required
             hint="At least 12 characters."
             errors={e?.password} />
      <Field label="Confirm password" name="confirmPassword" type="password"
             autoComplete="new-password" required
             errors={e?.confirmPassword} />

      <label className="mb-5 flex items-start gap-2.5 text-sm text-[#5E7370]">
        <input type="checkbox" name="terms" className="mt-1" />
        <span>
          I accept the terms and conditions and the privacy policy.
          {e?.terms ? <span className="block text-red-600">{e.terms[0]}</span> : null}
        </span>
      </label>

      <SubmitButton>{cta}</SubmitButton>
    </form>
  );
}

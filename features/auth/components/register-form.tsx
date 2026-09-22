"use client";

import { useActionState } from "react";
import { type ActionState } from "@/features/auth/actions";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export function RegisterForm({
  action,
  cta,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  cta: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  if (state.message) {
    return <Banner tone="success">{state.message}</Banner>;
  }

  return (
    <form action={formAction} noValidate>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <Field label="Your name" name="fullName" autoComplete="name" required
             errors={state.fieldErrors?.fullName} />
      <Field label="Email" name="email" type="email" autoComplete="email" required
             errors={state.fieldErrors?.email} />
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel"
             hint="Used for booking alerts. Optional."
             errors={state.fieldErrors?.phone} />
      <Field label="Password" name="password" type="password"
             autoComplete="new-password" required
             hint="At least 12 characters."
             errors={state.fieldErrors?.password} />
      <Field label="Confirm password" name="confirmPassword" type="password"
             autoComplete="new-password" required
             errors={state.fieldErrors?.confirmPassword} />

      <label className="mb-5 flex items-start gap-2.5 text-sm text-[#5E7370]">
        <input type="checkbox" name="terms" className="mt-1" />
        <span>
          I accept the terms and conditions and the privacy policy.
          {state.fieldErrors?.terms ? (
            <span className="block text-red-600">{state.fieldErrors.terms[0]}</span>
          ) : null}
        </span>
      </label>

      <SubmitButton>{cta}</SubmitButton>
    </form>
  );
}

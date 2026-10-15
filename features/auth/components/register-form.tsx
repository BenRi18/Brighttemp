"use client";

import { useActionState, useEffect } from "react";
import { resendConfirmation, type ActionState } from "@/features/auth/actions";
import { Field, SubmitButton, Banner } from "@/components/ui/form";
import { useFormDraft } from "./use-form-draft";

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
  const draft = useFormDraft(`register-${variant}`, state.values);
  const e = state.fieldErrors;
  const v = state.values;

  // Once the account exists there is nothing left to come back to.
  const done = Boolean(state.message);
  useEffect(() => {
    if (done) draft.clear();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.message) {
    return (
      <>
        <Banner tone="success">{state.message}</Banner>
        {state.pendingEmail ? <ResendPanel email={state.pendingEmail} /> : null}
      </>
    );
  }

  return (
    <form action={formAction} ref={draft.ref} onChange={draft.save} noValidate>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}

      {variant === "locum" ? (
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" autoComplete="given-name" required
                 defaultValue={v?.firstName} errors={e?.firstName} />
          <Field label="Surname" name="lastName" autoComplete="family-name" required
                 defaultValue={v?.lastName} errors={e?.lastName} />
        </div>
      ) : (
        <>
          <Field label="Practice name" name="practiceName" autoComplete="organization" required
                 defaultValue={v?.practiceName} errors={e?.practiceName} />
          <Field label="Address" name="addressLine1" autoComplete="address-line1" required
                 defaultValue={v?.addressLine1} errors={e?.addressLine1} />
          <Field label="Address line 2" name="addressLine2" autoComplete="address-line2"
                 defaultValue={v?.addressLine2} errors={e?.addressLine2} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Town or city" name="city" autoComplete="address-level2" required
                   defaultValue={v?.city} errors={e?.city} />
            <Field label="Postcode" name="postcode" autoComplete="postal-code" required
                   defaultValue={v?.postcode} placeholder="LS1 4DY" errors={e?.postcode} />
          </div>
        </>
      )}

      <Field label="Email" name="email" type="email" autoComplete="email" required
             defaultValue={v?.email} errors={e?.email} />
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel"
             hint="Used for booking alerts. Optional."
             defaultValue={v?.phone} errors={e?.phone} />
      <Field label="Password" name="password" type="password"
             autoComplete="new-password" required
             hint="At least 12 characters."
             errors={e?.password} />
      <Field label="Confirm password" name="confirmPassword" type="password"
             autoComplete="new-password" required
             errors={e?.confirmPassword} />

      <label className="mb-5 flex items-start gap-2.5 text-sm text-[#5E7370]">
        <input type="checkbox" name="terms" className="mt-1" defaultChecked={v?.terms === "on"} />
        <span>
          I accept the terms and conditions and the privacy policy.
          {e?.terms ? <span className="block text-red-600">{e.terms[0]}</span> : null}
        </span>
      </label>

      <SubmitButton>{cta}</SubmitButton>
    </form>
  );
}

/** An unconfirmed account shouldn't be a dead end when the email doesn't arrive. */
function ResendPanel({ email }: { email: string }) {
  const [state, action] = useActionState<ActionState, FormData>(resendConfirmation, {});

  return (
    <form action={action} className="mt-4 text-sm text-[#5E7370]">
      <input type="hidden" name="email" value={email} />
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}
      {!state.message ? (
        <p>
          Nothing after a few minutes?{" "}
          <button type="submit" className="font-semibold text-[#0E3B36] underline">
            Send it again
          </button>
          .
        </p>
      ) : null}
    </form>
  );
}

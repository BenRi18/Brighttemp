"use client";

import { useActionState } from "react";
import { completePracticeOnboarding, type ActionState } from "@/features/auth/actions";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export type PracticeDefaults = {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
};

/**
 * Pre-filled with whatever the practice gave when registering, so this screen
 * is a confirmation rather than the same address typed a second time. Every
 * field stays editable — a registration typo has to be fixable here.
 */
export function PracticeOnboardingForm({ defaults }: { defaults: PracticeDefaults }) {
  const [state, action] = useActionState<ActionState, FormData>(
    completePracticeOnboarding,
    {},
  );
  const e = state.fieldErrors;

  return (
    <form action={action} noValidate>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <Field label="Practice name" name="name" required defaultValue={defaults.name}
             errors={e?.name} />
      <Field label="Trading name" name="tradingName" errors={e?.tradingName}
             hint="If it differs from the registered name." />
      <Field label="Address" name="addressLine1" required defaultValue={defaults.addressLine1}
             autoComplete="address-line1" errors={e?.addressLine1} />
      <Field label="Address line 2" name="addressLine2" defaultValue={defaults.addressLine2}
             autoComplete="address-line2" errors={e?.addressLine2} />
      <Field label="Town or city" name="city" required defaultValue={defaults.city}
             autoComplete="address-level2" errors={e?.city} />
      <Field label="Postcode" name="postcode" required defaultValue={defaults.postcode}
             autoComplete="postal-code" placeholder="LS1 4DY" errors={e?.postcode} />
      <Field label="Practice phone" name="phone" type="tel" errors={e?.phone} />
      <Field label="Billing email" name="billingEmail" type="email"
             hint="Where Brighttemp invoices should go, if different."
             errors={e?.billingEmail} />
      <Field label="VAT number" name="vatNumber" errors={e?.vatNumber} />
      <SubmitButton>Submit for approval</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { completePracticeOnboarding, type ActionState } from "@/features/auth/actions";
import { AuthCard } from "@/components/layout/auth-card";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export default function PracticeOnboardingPage() {
  const [state, action] = useActionState<ActionState, FormData>(
    completePracticeOnboarding,
    {},
  );

  return (
    <AuthCard
      title="Tell us about the practice"
      lede="We use the postcode to work out which locums are in range."
    >
      <form action={action} noValidate>
        {state.error ? <Banner tone="error">{state.error}</Banner> : null}
        <Field label="Practice name" name="name" required errors={state.fieldErrors?.name} />
        <Field label="Trading name" name="tradingName" errors={state.fieldErrors?.tradingName}
               hint="If it differs from the registered name." />
        <Field label="Address" name="addressLine1" required
               errors={state.fieldErrors?.addressLine1} />
        <Field label="Address line 2" name="addressLine2"
               errors={state.fieldErrors?.addressLine2} />
        <Field label="Town or city" name="city" required errors={state.fieldErrors?.city} />
        <Field label="Postcode" name="postcode" required
               errors={state.fieldErrors?.postcode} placeholder="LS1 4DY" />
        <Field label="Practice phone" name="phone" type="tel" errors={state.fieldErrors?.phone} />
        <Field label="Billing email" name="billingEmail" type="email"
               hint="Where Brighttemp invoices should go, if different."
               errors={state.fieldErrors?.billingEmail} />
        <Field label="VAT number" name="vatNumber" errors={state.fieldErrors?.vatNumber} />
        <SubmitButton>Submit for approval</SubmitButton>
      </form>
    </AuthCard>
  );
}

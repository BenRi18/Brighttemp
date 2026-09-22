"use client";

import { useActionState } from "react";
import { updatePractice } from "@/features/practices/actions";
import type { ActionState } from "@/features/auth/actions";
import type { Practice } from "@/lib/database.types";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export function PracticeSettingsForm({
  practice,
  canEdit,
}: {
  practice: Practice;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updatePractice, {});

  if (!canEdit) {
    return (
      <p className="rounded-lg border border-line bg-white px-4 py-3 text-muted">
        Only an owner or manager can change these details.
      </p>
    );
  }

  return (
    <form action={action} className="max-w-xl rounded-xl border border-line bg-white p-5">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <Field label="Practice name" name="name" defaultValue={practice.name} required
             errors={state.fieldErrors?.name} />
      <Field label="Trading name" name="tradingName" defaultValue={practice.trading_name ?? ""}
             errors={state.fieldErrors?.tradingName} />
      <Field label="Address" name="addressLine1" defaultValue={practice.address_line1} required
             errors={state.fieldErrors?.addressLine1} />
      <Field label="Address line 2" name="addressLine2" defaultValue={practice.address_line2 ?? ""}
             errors={state.fieldErrors?.addressLine2} />
      <Field label="Town or city" name="city" defaultValue={practice.city} required
             errors={state.fieldErrors?.city} />
      <Field label="Postcode" name="postcode" defaultValue={practice.postcode} required
             hint="Changing this re-checks which locums are in range."
             errors={state.fieldErrors?.postcode} />
      <Field label="Phone" name="phone" type="tel" defaultValue={practice.phone ?? ""}
             errors={state.fieldErrors?.phone} />
      <Field label="Billing email" name="billingEmail" type="email"
             defaultValue={practice.billing_email ?? ""}
             errors={state.fieldErrors?.billingEmail} />
      <Field label="VAT number" name="vatNumber" defaultValue={practice.vat_number ?? ""}
             errors={state.fieldErrors?.vatNumber} />

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

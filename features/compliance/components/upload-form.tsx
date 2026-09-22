"use client";

import { useActionState, useState } from "react";
import { uploadDocument } from "@/features/compliance/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

export function UploadForm({
  docType,
  label,
  hasExisting,
}: {
  docType: string;
  label: string;
  hasExisting: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(uploadDocument, {});
  const [open, setOpen] = useState(!hasExisting);

  if (!open) {
    return (
      <>
        {state.message ? <Banner tone="success">{state.message}</Banner> : null}
        <button onClick={() => setOpen(true)} className="text-sm font-semibold text-pine underline">
          Replace this document
        </button>
      </>
    );
  }

  const field = "w-full rounded-lg border border-line px-3 py-2 text-sm";

  return (
    <form action={action}>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}
      <input type="hidden" name="docType" value={docType} />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="mb-1 block text-sm font-semibold text-muted" htmlFor={`file-${docType}`}>
            {label} (PDF, JPG or PNG, up to 10MB)
          </label>
          <input
            id={`file-${docType}`}
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/heic"
            required
            className={field}
          />
          {state.fieldErrors?.file ? (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.file[0]}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-muted" htmlFor={`issue-${docType}`}>
            Issued
          </label>
          <input id={`issue-${docType}`} name="issueDate" type="date" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-muted" htmlFor={`expiry-${docType}`}>
            Expires
          </label>
          <input id={`expiry-${docType}`} name="expiryDate" type="date" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-muted" htmlFor={`ref-${docType}`}>
            Reference
          </label>
          <input id={`ref-${docType}`} name="reference" className={field} />
        </div>
      </div>

      <button className="mt-3 rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white">
        Upload
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { reviewDocument } from "@/features/compliance/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

export function DocumentReview({
  documentId,
  storagePath,
  label,
  locumName,
  roleName,
  expiryDate,
  reference,
}: {
  documentId: string;
  storagePath: string;
  label: string;
  locumName: string;
  roleName: string;
  expiryDate: string | null;
  reference: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reviewDocument, {});
  const [rejecting, setRejecting] = useState(false);

  if (state.message) return <Banner tone="success">{state.message}</Banner>;

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {locumName} — {label}
          </p>
          <p className="text-sm text-muted">
            {roleName}
            {expiryDate ? ` · expires ${new Date(expiryDate).toLocaleDateString("en-GB")}` : ""}
            {reference ? ` · ref ${reference}` : ""}
          </p>
        </div>

        {/* Opens a short-lived signed URL; the bucket itself stays private. */}
        <a
          href={`/admin/compliance/view?path=${encodeURIComponent(storagePath)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-pine"
        >
          View file
        </a>

        <form action={action}>
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="decision" value="approve" />
          <button className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white">
            Approve
          </button>
        </form>

        {!rejecting && (
          <button
            onClick={() => setRejecting(true)}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-muted"
          >
            Reject
          </button>
        )}
      </div>

      {rejecting && (
        <form action={action} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="decision" value="reject" />
          <input
            name="rejectionReason"
            required
            placeholder="What does the locum need to fix?"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button className="rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white">
            Confirm rejection
          </button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { reviewPractice, reviewLocum } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

export function ApprovalRow({
  id,
  kind,
  title,
  subtitle,
}: {
  id: string;
  kind: "practice" | "locum";
  title: string;
  subtitle: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    kind === "practice" ? reviewPractice : reviewLocum,
    {},
  );
  const [rejecting, setRejecting] = useState(false);

  if (state.message) return <Banner tone="success">{state.message}</Banner>;

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>

        <form action={action}>
          <input type="hidden" name="id" value={id} />
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
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <input
            name="reason"
            required
            placeholder="Reason — the applicant sees this"
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

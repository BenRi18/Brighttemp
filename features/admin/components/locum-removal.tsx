"use client";

import { useActionState, useState } from "react";
import { archiveLocum, unarchiveLocum, deleteLocum } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import type { RemovalCheck } from "@/features/locums/queries";
import { Banner } from "@/components/ui/form";
import { stampDate } from "@/lib/format";

/**
 * Taking a locum off the books.
 *
 * Which of the two operations is on offer is decided by the database, not by
 * this component: a locum who has ever been booked cannot be deleted, because
 * bookings.locum_id is `on delete restrict` and because those bookings and the
 * invoices against them are records that have to be kept. For them the panel
 * offers the archive and says why that is the only option — rather than
 * showing a delete button that would fail.
 */
export function LocumRemoval({
  locumId,
  name,
  archivedAt,
  archiveReason,
  check,
}: {
  locumId: string;
  name: string;
  archivedAt: string | null;
  archiveReason: string | null;
  check: RemovalCheck;
}) {
  if (archivedAt) {
    return (
      <Archived
        locumId={locumId}
        name={name}
        archivedAt={archivedAt}
        archiveReason={archiveReason}
      />
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-1 text-lg font-bold">Take off the books</h2>

      {check.unavailable ? (
        <p className="text-sm text-muted">{check.unavailable}</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {check.canDelete
              ? `${name} has never had a booking, so there is nothing on their record worth keeping.`
              : `${name} has ${count(check.bookingsTotal, "booking")} on record.`}
          </p>

          <ArchiveForm
            locumId={locumId}
            upcoming={check.bookingsUpcoming}
            only={!check.canDelete}
          />

          {check.canDelete ? (
            <DeleteForm locumId={locumId} name={name} documents={check.documents} />
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
              Deleting isn&apos;t possible for a locum who has worked — their bookings and
              any invoices raised against them are financial records, and HMRC expects
              those kept for six years. Archiving takes them out of practice search and
              off the roster, which is the same thing from a practice&apos;s point of view.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ArchiveForm({
  locumId,
  upcoming,
  only,
}: {
  locumId: string;
  upcoming: number;
  only: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(archiveLocum, {});

  return (
    <div>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      {upcoming > 0 ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {count(upcoming, "shift")} still to work. Cancel {upcoming === 1 ? "it" : "them"}{" "}
          first so the practice is told and the cancellation terms apply — then archive.
        </p>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locumId" value={locumId} />
          <label className="min-w-[14rem] flex-1 text-sm">
            <span className="mb-1 block font-semibold">Reason (optional)</span>
            <input
              type="text"
              name="reason"
              maxLength={300}
              placeholder="Left the register, moved away…"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>
          <button
            className={`rounded-full px-5 py-2 text-sm font-semibold ${
              only ? "bg-pine text-white" : "border border-line text-[#12211F]"
            }`}
          >
            Archive
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Two steps on purpose. The first button only reveals what is about to happen;
 * nothing is sent until the box is ticked and the second button pressed. The
 * action re-checks eligibility against the database either way, so a page left
 * open while the locum took a booking cannot delete them.
 */
function DeleteForm({
  locumId,
  name,
  documents,
}: {
  locumId: string;
  name: string;
  documents: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(deleteLocum, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        {state.error ? <Banner tone="error">{state.error}</Banner> : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-red-700 underline"
        >
          Delete {name} permanently
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}

      <h3 className="mb-2 text-sm font-bold text-red-900">
        This cannot be undone. Deleting {name} removes:
      </h3>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-red-900">
        <li>their account and everything on it — rates, availability, profile</li>
        <li>
          {documents > 0
            ? `${count(documents, "uploaded document")}, including the files themselves`
            : "any uploaded documents"}
        </li>
        <li>their login, which frees the email address to register again</li>
      </ul>
      <p className="mb-4 text-sm text-red-900">
        A line goes in the audit log recording that you deleted them, and when.
      </p>

      <form action={action} className="flex flex-wrap items-center gap-4">
        <input type="hidden" name="locumId" value={locumId} />
        <label className="flex items-center gap-2 text-sm font-semibold text-red-900">
          <input
            type="checkbox"
            name="confirm"
            value="delete"
            required
            className="h-4 w-4 rounded border-red-300"
          />
          I understand this is permanent
        </label>
        <button className="rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white">
          Delete permanently
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold text-red-900 underline"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

function Archived({
  locumId,
  name,
  archivedAt,
  archiveReason,
}: {
  locumId: string;
  name: string;
  archivedAt: string;
  archiveReason: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(unarchiveLocum, {});

  return (
    <section className="rounded-xl border border-line bg-[#F7F4EC] p-5">
      <h2 className="mb-1 text-lg font-bold">Archived</h2>
      <p className="mb-4 text-sm text-muted">
        Off the books since {stampDate(archivedAt)}
        {archiveReason ? ` — ${archiveReason}` : ""}. {name} is out of practice search and
        hidden from the roster. Every booking and invoice is still there.
      </p>

      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <form action={action}>
        <input type="hidden" name="locumId" value={locumId} />
        <button className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white">
          Put back on the books
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        They won&apos;t go straight back into search unless their documents are still in
        date.
      </p>
    </section>
  );
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

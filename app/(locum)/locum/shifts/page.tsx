import { requireLocum } from "@/features/auth/session";
import { shiftsForLocum } from "@/features/shifts/queries";
import { ClaimButton } from "@/features/shifts/components/claim-button";
import { PageHeading } from "@/components/layout/portal-shell";
import { Badge } from "@/components/ui/badge";
import { money, hourly, shiftDate, shiftTimes } from "@/lib/format";

export const metadata = { title: "Shift board — Brighttemp" };

/**
 * Work going spare.
 *
 * Only shows shifts this locum could actually take: right role, documents in
 * date, within their own travel radius, and not clashing with something they
 * are already booked for. An empty board is usually a real answer, not a
 * fault — which is why the empty state says what would change it.
 */
export default async function LocumShiftsPage() {
  const account = await requireLocum({ requireApproved: true });
  const shifts = await shiftsForLocum(account.locum.id);

  return (
    <>
      <PageHeading
        title="Shift board"
        lede="Gaps practices have posted that you could cover. Offering isn't a booking — the practice confirms."
      />

      {shifts.length === 0 ? (
        <div className="rounded-xl border border-line bg-white px-5 py-8 text-center">
          <p className="mb-2 font-semibold">No shifts you can take right now.</p>
          <p className="text-sm text-muted">
            Shifts show here when a practice near you posts one for your role. You&apos;ll
            also get a message when one appears — check your profile if you&apos;d rather
            have those on WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shifts.map((s) => (
            <article key={s.shiftId} className="rounded-xl border border-line bg-white p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">
                    {s.practiceName}
                    {s.practiceCity ? ` · ${s.practiceCity}` : ""}
                  </h2>
                  <p className="text-sm text-muted">
                    {shiftDate(s.shiftDate)} · {shiftTimes(s.startTime, s.finishTime)} ·{" "}
                    {s.hours} hours
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{s.roleName}</Badge>
                  {s.distanceMiles !== null ? (
                    <span className="text-sm text-muted">{s.distanceMiles} miles</span>
                  ) : null}
                </div>
              </div>

              {s.yourRate !== null ? (
                <p className="mb-3 text-sm">
                  <strong>{money(s.yourTotal)}</strong> at your rate of {hourly(s.yourRate)}
                </p>
              ) : null}

              {s.notes ? <p className="mb-3 text-sm text-muted">{s.notes}</p> : null}

              <ClaimButton
                shiftId={s.shiftId}
                claimed={s.alreadyClaimed}
                canClaim={s.yourRate !== null}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

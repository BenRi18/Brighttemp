import { requireAdmin } from "@/features/auth/session";
import { allShifts, practicesForPosting } from "@/features/shifts/queries";
import { allRoles } from "@/features/locums/queries";
import { AgencyShiftForm } from "@/features/admin/components/agency-shift-form";
import { ShiftOffers } from "@/features/shifts/components/shift-offers";
import { PageHeading } from "@/components/layout/portal-shell";

export const metadata = { title: "Shifts — Brighttemp admin" };

/**
 * The agency's own view of the board.
 *
 * Its reason for existing is the practice that rings up instead of logging
 * in. Before this, that shift was worked by whoever Brighttemp could think
 * of and phone. Posting it here puts it in front of every locum who could
 * actually take it, which is the whole point of having a board.
 *
 * Everything posted here behaves exactly like a shift a practice posts for
 * itself — same notifications, same claiming, same booking and invoice at
 * the end. The only difference is who typed it in.
 */
export default async function AdminShiftsPage() {
  await requireAdmin();
  const [shifts, practices, roles] = await Promise.all([
    allShifts(),
    practicesForPosting(),
    allRoles(),
  ]);

  const open = shifts.filter((s) => s.status === "open");
  const waiting = open.filter((s) => s.claims.some((c) => c.status === "offered"));
  const past = shifts.filter((s) => s.status !== "open");

  return (
    <>
      <PageHeading
        title="Shifts"
        lede="Post a shift for a practice that rang in, and pick who covers it."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <AgencyShiftForm practices={practices} roles={roles} />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted">
            {open.length} open
            {waiting.length > 0
              ? ` · ${waiting.length} with ${
                  waiting.length === 1 ? "someone" : "people"
                } waiting on an answer`
              : ""}
          </p>

          {open.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-5 py-8 text-center text-muted">
              Nothing open at the moment.
            </p>
          ) : (
            open.map((s) => (
              <ShiftOffers key={s.id} shift={s} portal="admin" practiceName={s.practiceName} />
            ))
          )}

          {past.length > 0 ? (
            <>
              <h2 className="pt-4 text-lg font-bold">Earlier</h2>
              {past.slice(0, 20).map((s) => (
                <ShiftOffers
                  key={s.id}
                  shift={s}
                  portal="admin"
                  practiceName={s.practiceName}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

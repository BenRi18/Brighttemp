import { requirePractice } from "@/features/auth/session";
import { shiftsForPractice } from "@/features/shifts/queries";
import { allRoles } from "@/features/locums/queries";
import { PostShiftForm } from "@/features/shifts/components/post-shift-form";
import { ShiftOffers } from "@/features/shifts/components/shift-offers";
import { PageHeading } from "@/components/layout/portal-shell";

export const metadata = { title: "Open shifts — Brighttemp" };

/**
 * The other way to find cover: post the gap and let people come to you.
 *
 * Search is better when the practice knows who they want. This is for when
 * they just need Tuesday covered — which, at eight in the morning with
 * somebody off sick, is most of the time.
 */
export default async function PracticeShiftsPage() {
  const account = await requirePractice();
  const [shifts, roles] = await Promise.all([
    shiftsForPractice(account.practice.practice.id),
    allRoles(),
  ]);

  const open = shifts.filter((s) => s.status === "open");
  const past = shifts.filter((s) => s.status !== "open");

  return (
    <>
      <PageHeading
        title="Open shifts"
        lede="Post a gap and let any qualified locum nearby offer for it. You pick who gets it."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <PostShiftForm roles={roles} />
        </div>

        <div className="space-y-4">
          {open.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-5 py-8 text-center text-muted">
              Nothing posted at the moment.
            </p>
          ) : (
            open.map((s) => <ShiftOffers key={s.id} shift={s} />)
          )}

          {past.length > 0 ? (
            <>
              <h2 className="pt-4 text-lg font-bold">Earlier</h2>
              {past.map((s) => (
                <ShiftOffers key={s.id} shift={s} />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

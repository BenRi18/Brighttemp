"use client";

import { useActionState } from "react";
import { requestBooking } from "@/features/bookings/actions";
import type { ActionState } from "@/features/auth/actions";
import type { SearchResult } from "@/lib/database.types";
import type { SearchInput } from "../schema";
import { money, hourly } from "@/lib/format";
import { Banner } from "@/components/ui/form";

export function ResultList({
  results,
  search,
  favourites,
}: {
  results: SearchResult[];
  search: SearchInput;
  favourites: string[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(requestBooking, {});
  const favouriteSet = new Set(favourites);

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
        <p className="text-lg font-semibold">Nobody free for that shift</p>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Try widening the distance, or shortening the hours — a locum has to be free for the
          whole shift to appear.
        </p>
      </div>
    );
  }

  // Favourites first, then whatever order the database ranked them in.
  const sorted = [...results].sort(
    (a, b) => Number(favouriteSet.has(b.locum_id)) - Number(favouriteSet.has(a.locum_id)),
  );

  return (
    <>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <p className="mb-4 text-sm text-muted">
        {results.length} available · shift {search.startTime}–{search.finishTime}
      </p>

      <div className="space-y-3">
        {sorted.map((r) => (
          <div
            key={r.locum_id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {r.full_name}
                {favouriteSet.has(r.locum_id) ? (
                  <span className="ml-2 text-xs font-semibold text-amber-deep">★ Favourite</span>
                ) : null}
              </p>
              <p className="text-sm text-muted">
                {r.years_experience} years&apos; experience · {r.distance_miles} miles ·{" "}
                <span className="font-semibold text-mint">All documents clear</span>
              </p>
            </div>

            <div className="text-right text-sm text-muted">
              <p className="text-lg font-bold text-[#12211F]">{hourly(r.hourly_rate)}</p>
              <p>
                {money(r.locum_total)} to the locum + {money(r.booking_fee)} fee
              </p>
              <p className="font-semibold text-[#12211F]">
                {money(r.total_practice_cost)} total
              </p>
            </div>

            <form action={action}>
              <input type="hidden" name="locumId" value={r.locum_id} />
              <input type="hidden" name="roleId" value={search.roleId} />
              <input type="hidden" name="date" value={search.date} />
              <input type="hidden" name="startTime" value={search.startTime} />
              <input type="hidden" name="finishTime" value={search.finishTime} />
              <input type="hidden" name="hourlyRate" value={r.hourly_rate} />
              <button
                type="submit"
                className="rounded-full bg-pine px-5 py-2.5 font-semibold text-white"
              >
                Request
              </button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}

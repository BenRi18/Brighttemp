import Link from "next/link";
import { requirePractice } from "@/features/auth/session";
import { listFavourites } from "@/features/practices/queries";
import { PageHeading } from "@/components/layout/portal-shell";
import { EmptyState } from "@/components/ui/empty-state";

export default async function FavouritesPage() {
  const { practice } = await requirePractice();
  const favourites = await listFavourites(practice.practice.id);

  return (
    <>
      <PageHeading
        title="Favourites"
        lede="Locums you've saved appear first in your search results."
      />

      {favourites.length === 0 ? (
        <EmptyState
          title="No favourites yet"
          body="Save the locums who fit your practice and they'll be easy to find next time."
          action={{ href: "/practice/search", label: "Find cover" }}
        />
      ) : (
        <div className="space-y-3">
          {favourites.map((f) => (
            <div
              key={f.locum_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{f.locums?.profiles?.full_name}</p>
                <p className="text-sm text-muted">
                  {f.locums?.roles?.name} · {f.locums?.years_experience} years ·{" "}
                  {f.locums?.base_postcode}
                </p>
              </div>
              {f.locums?.is_bookable ? (
                <Link
                  href="/practice/search"
                  className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white"
                >
                  Check availability
                </Link>
              ) : (
                <span className="text-sm text-muted">Not currently bookable</span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
